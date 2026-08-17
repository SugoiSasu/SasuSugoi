import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'
import { createFileRoute } from '@tanstack/react-router'

// Resend webhook payload (Standard Webhooks/svix-signed).
// See https://resend.com/docs/dashboard/webhooks/introduction
interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    email_id?: string
    to?: string[]
    tags?: Record<string, string>
    bounce?: { type?: string; subType?: string; message?: string }
  }
}

function mapEventToStatus(type: string): 'bounced' | 'complained' | null {
  switch (type) {
    case 'email.bounced':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    default:
      return null
  }
}

function mapEventToMessage(type: string, bounce?: { message?: string }): string {
  if (type === 'email.bounced') {
    return bounce?.message ?? 'Permanent bounce — email address is invalid or rejected'
  }
  if (type === 'email.complained') {
    return 'Spam complaint — recipient marked email as spam'
  }
  return 'Email suppressed'
}

export const Route = createFileRoute('/lovable/email/suppression')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const rawBody = await request.text()
        const headers = Object.fromEntries(request.headers)

        let payload: ResendWebhookPayload
        try {
          const wh = new Webhook(webhookSecret)
          payload = wh.verify(rawBody, headers) as ResendWebhookPayload
        } catch (error) {
          console.error('Invalid webhook signature', {
            error: error instanceof Error ? error.message : String(error),
          })
          return Response.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // Our own /email/unsubscribe route (linked via the List-Unsubscribe header
        // we send) handles unsubscribes directly — no webhook round-trip needed for
        // that path. This endpoint only tracks bounces and spam complaints.
        const status = mapEventToStatus(payload.type)
        if (!status) {
          return Response.json({ success: true, ignored: payload.type })
        }

        const recipient = payload.data.to?.[0]
        if (!recipient) {
          console.error('Suppression event missing recipient', { type: payload.type })
          return Response.json({ error: 'Invalid payload: missing recipient' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const normalizedEmail = recipient.toLowerCase()

        // 1. Upsert to suppressed_emails (idempotent — safe for webhook retries)
        const { error: suppressError } = await supabase.from('suppressed_emails').upsert(
          {
            email: normalizedEmail,
            reason: status === 'bounced' ? 'bounce' : 'complaint',
            metadata: payload.data.bounce ?? null,
          },
          { onConflict: 'email' },
        )

        if (suppressError) {
          console.error('Failed to upsert suppressed email', {
            error: suppressError,
            email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
          })
          return Response.json({ error: 'Failed to write suppression' }, { status: 500 })
        }

        // 2. Append a new log entry for the suppression event (never update existing rows)
        const { error: insertError } = await supabase.from('email_send_log').insert({
          message_id: payload.data.email_id ?? null,
          template_name: payload.data.tags?.label ?? 'system',
          recipient_email: normalizedEmail,
          status,
          error_message: mapEventToMessage(payload.type, payload.data.bounce),
        })

        if (insertError) {
          // Non-fatal — log and continue. The suppression was already recorded.
          console.warn('Failed to insert email_send_log', { error: insertError })
        }

        console.log('Suppression processed', {
          email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
          type: payload.type,
        })

        return Response.json({ success: true })
      },
    },
  },
})
