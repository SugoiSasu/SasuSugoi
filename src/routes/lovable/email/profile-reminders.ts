import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { enqueueTransactionalEmailInternal } from '@/lib/email/enqueue-internal.server'

function rowne(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Przypomnienia dostaja tylko konta zalozone PO uruchomieniu funkcji: bez tej
// daty pierwszy przebieg wyslalby maile wszystkim dotychczasowym uzytkownikom.
const OD_DATY = process.env.PROFILE_REMINDERS_FROM || '2026-10-08T00:00:00Z'
const MIN_GODZIN = 24
const MAX_DNI = 7
const PARTIA = 50

/**
 * Raz dziennie (pg_cron): konta sprzed doby (do tygodnia) bez zdjecia lub bio
 * dostaja jeden mail z prosba o uzupelnienie profilu. Kryterium to to samo, co
 * odznaka "Kompletny profil" (avatar + bio). Dostep jak /queue/process: Bearer
 * z kluczem service role.
 */
export const Route = createFileRoute('/lovable/email/profile-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) return Response.json({ error: 'Server configuration error' }, { status: 500 })
        const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '').trim() ?? ''
        if (!token || !rowne(token, key)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
        const teraz = Date.now()
        const od = new Date(Math.max(new Date(OD_DATY).getTime(), teraz - MAX_DNI * 86400_000)).toISOString()
        const do_ = new Date(teraz - MIN_GODZIN * 3600_000).toISOString()

        const { data: kandydaci, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, created_at')
          .gte('created_at', od)
          .lte('created_at', do_)
          .order('created_at', { ascending: true })
          .limit(PARTIA * 3)
        if (error) return Response.json({ error: error.message }, { status: 500 })

        const niepelne = (kandydaci ?? []).filter(
          (p) => !(p.avatar_url ?? '').trim() || !(p.bio ?? '').trim(),
        )
        if (!niepelne.length) return Response.json({ wyslano: 0, kandydaci: 0 })

        const { data: juz } = await supabase
          .from('profile_reminders' as never)
          .select('user_id')
          .in('user_id', niepelne.map((p) => p.id))
        // ?dry=1: tylko lista kandydatow, nic nie trafia do kolejki (do testow).
        const dry = new URL(request.url).searchParams.get('dry') === '1'
        const wyslane = new Set(((juz ?? []) as unknown as { user_id: string }[]).map((r) => r.user_id))

        if (dry) {
          const kto = niepelne.filter((x) => !wyslane.has(x.id)).map((x) => ({ id: x.id, avatar: !!(x.avatar_url ?? '').trim(), bio: !!(x.bio ?? '').trim() }))
          return Response.json({ dry: true, doWyslania: kto.length, kto })
        }
        let wyslano = 0
        let pominieto = 0
        for (const p of niepelne.filter((x) => !wyslane.has(x.id)).slice(0, PARTIA)) {
          const { data: u } = await supabase.auth.admin.getUserById(p.id)
          const konto = u?.user
          const email = konto?.email
          // Bez potwierdzonego maila (albo bez maila - konto anonimowe) nic nie wysylamy.
          if (!konto || !email || !konto.email_confirmed_at) {
            pominieto++
            continue
          }
          const wynik = await enqueueTransactionalEmailInternal({
            templateName: 'profile-reminder',
            recipientEmail: email,
            idempotencyKey: `profile-reminder-${p.id}`,
            templateData: {
              name: (p.display_name ?? '').trim().split(/\s+/)[0] || undefined,
              missingAvatar: !(p.avatar_url ?? '').trim(),
              missingBio: !(p.bio ?? '').trim(),
            },
          })
          // Wypisany/zablokowany adres tez zapisujemy, zeby nie ponawiac w nieskonczonosc.
          if (wynik.ok || wynik.reason === 'email_suppressed') {
            await supabase.from('profile_reminders' as never).insert({ user_id: p.id } as never)
            if (wynik.ok) wyslano++
          } else {
            pominieto++
          }
        }
        return Response.json({ wyslano, pominieto, kandydaci: niepelne.length })
      },
    },
  },
})
