import * as React from 'react'
import { render } from '@react-email/components'
import { Webhook } from 'standardwebhooks'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Potwierdź swój email — poŻeramy',
  invite: 'Zaproszenie do poŻeramy',
  magiclink: 'Twój link logowania — poŻeramy',
  recovery: 'Zresetuj hasło — poŻeramy',
  email_change: 'Potwierdź nowy adres email — poŻeramy',
  reauthentication: 'Twój kod weryfikacyjny — poŻeramy',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'poŻeramy'
const FROM_DOMAIN = 'pozeramy.live'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

// Builds the link the user clicks in the email. It points at our own
// /auth/confirm page (client-side route), which calls supabase.auth.verifyOtp
// with the token_hash — this app uses client-held sessions (localStorage), so
// the OTP exchange has to happen in the browser, not in this server handler.
function buildConfirmationUrl(siteUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  const url = new URL('/auth/confirm', siteUrl)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', type)
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo)
  return url.toString()
}

async function renderAndQueue(
  supabase: SupabaseClient<any, any>,
  emailType: string,
  recipient: string,
  templateProps: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string }> {
  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) return { ok: false, reason: 'unknown_email_type' }

  const element = React.createElement(EmailTemplate, templateProps)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { ok: false, reason: 'enqueue_failed' }
  }

  return { ok: true }
}

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hookSecretRaw = process.env.SEND_EMAIL_HOOK_SECRET
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!hookSecretRaw || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Standard Webhooks verification (Supabase Auth Hooks spec).
        // Secret is generated in the Supabase Dashboard as "v1,whsec_<base64>" —
        // the "v1,whsec_" prefix must be stripped before handing it to the Webhook class.
        const rawBody = await request.text()
        const headers = Object.fromEntries(request.headers)

        let payload: any
        try {
          const wh = new Webhook(hookSecretRaw.replace('v1,whsec_', ''))
          payload = wh.verify(rawBody, headers)
        } catch (error) {
          console.error('Invalid webhook signature', {
            error: error instanceof Error ? error.message : String(error),
          })
          return Response.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const emailType: string | undefined = payload?.email_data?.email_action_type
        const siteUrl: string | undefined = payload?.email_data?.site_url
        const redirectTo: string = payload?.email_data?.redirect_to ?? ''

        if (!emailType || !siteUrl) {
          console.error('Webhook payload missing required fields', { emailType, hasSiteUrl: !!siteUrl })
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        if (!EMAIL_TEMPLATES[emailType]) {
          console.error('Unknown email type', { emailType })
          return Response.json({ error: `Unknown email type: ${emailType}` }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        console.log('Received auth email hook event', {
          emailType,
          email_redacted: redactEmail(payload.user?.email),
        })

        // "email_change" with Secure Email Change enabled (Supabase default) needs
        // TWO emails, one per address, each confirming from that address's inbox.
        // Field names are reversed by Supabase for backward compatibility:
        // token_hash_new pairs with the CURRENT address, token_hash with the NEW one.
        if (emailType === 'email_change' && payload.email_data.token_hash && payload.email_data.token_hash_new) {
          const oldEmail: string | undefined = payload.user?.email
          const newEmail: string | undefined = payload.user?.new_email

          if (!oldEmail || !newEmail) {
            console.error('email_change payload missing old/new email', { hasOld: !!oldEmail, hasNew: !!newEmail })
            return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
          }

          const results = await Promise.all([
            renderAndQueue(supabase, 'email_change', oldEmail, {
              siteName: SITE_NAME,
              oldEmail,
              newEmail,
              email: oldEmail,
              confirmationUrl: buildConfirmationUrl(siteUrl, payload.email_data.token_hash_new, emailType, redirectTo),
            }),
            renderAndQueue(supabase, 'email_change', newEmail, {
              siteName: SITE_NAME,
              oldEmail,
              newEmail,
              email: newEmail,
              confirmationUrl: buildConfirmationUrl(siteUrl, payload.email_data.token_hash, emailType, redirectTo),
            }),
          ])

          if (results.some((r) => !r.ok)) {
            return Response.json({ error: 'Failed to enqueue one or more emails' }, { status: 500 })
          }
          return Response.json({ success: true, queued: true })
        }

        const recipient: string | undefined = payload.user?.email
        if (!recipient) {
          console.error('Webhook payload missing recipient email', { emailType })
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        const templateProps: Record<string, unknown> = {
          siteName: SITE_NAME,
          siteUrl,
          recipient,
          email: recipient,
          token: payload.email_data.token,
          confirmationUrl: payload.email_data.token_hash
            ? buildConfirmationUrl(siteUrl, payload.email_data.token_hash, emailType, redirectTo)
            : '',
        }

        const result = await renderAndQueue(supabase, emailType, recipient, templateProps)
        if (!result.ok) {
          return Response.json({ error: 'Failed to enqueue email' }, { status: 500 })
        }

        console.log('Auth email enqueued', { emailType, email_redacted: redactEmail(recipient) })
        return Response.json({ success: true, queued: true })
      },
    },
  },
})
