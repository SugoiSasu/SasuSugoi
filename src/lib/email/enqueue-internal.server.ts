import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Bake-in config (must mirror /lovable/email/transactional/send.ts).
const SITE_NAME = 'pozeramy'
const SENDER_DOMAIN = 'notify.pozeramy.live'
const FROM_DOMAIN = 'pozeramy.live'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface EnqueueParams {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
}

/**
 * Server-only helper: renders a registered template and enqueues it for sending
 * using the Supabase service role. Use from PUBLIC/unauthenticated triggers
 * (contact forms, collab submissions) — the standard send route requires a user JWT.
 */
export async function enqueueTransactionalEmailInternal({
  templateName,
  recipientEmail,
  idempotencyKey,
  templateData = {},
}: EnqueueParams): Promise<{ ok: boolean; reason?: string }> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('enqueueTransactionalEmailInternal: missing env')
    return { ok: false, reason: 'config' }
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('enqueueTransactionalEmailInternal: template not found', templateName)
    return { ok: false, reason: 'template_not_found' }
  }

  const effectiveRecipient = (template.to || recipientEmail || '').trim()
  if (!effectiveRecipient) return { ok: false, reason: 'no_recipient' }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const messageId = crypto.randomUUID()
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Suppression check (fail-closed)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails').select('id').eq('email', normalizedEmail).maybeSingle()
  if (suppressionError) {
    console.error('suppression check failed', suppressionError)
    return { ok: false, reason: 'suppression_check_failed' }
  }
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'suppressed',
    })
    return { ok: false, reason: 'email_suppressed' }
  }

  // Unsubscribe token: reuse existing unused token or create one
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalizedEmail).maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    const candidate = generateToken()
    await supabase.from('email_unsubscribe_tokens').upsert(
      { token: candidate, email: normalizedEmail },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens').select('token').eq('email', normalizedEmail).maybeSingle()
    if (!stored) return { ok: false, reason: 'token_error' }
    unsubscribeToken = stored.token
  } else {
    return { ok: false, reason: 'email_suppressed' }
  }

  // Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const resolvedSubject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  // Log pending BEFORE enqueue
  await supabase.from('email_send_log').insert({
    message_id: messageId, template_name: templateName,
    recipient_email: effectiveRecipient, status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('enqueue failed', enqueueError)
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { ok: false, reason: 'enqueue_failed' }
  }

  return { ok: true }
}
