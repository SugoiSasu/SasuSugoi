-- 1) CTA button label on ads (nullable — components fall back to a generic
--    default when not set, so existing ads don't need backfilling).
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS cta_label text;

-- 2) ad_events gains user_id. Going forward, tracking only ever fires for
--    logged-in users (client-side gate) — anonymous impressions/clicks are no
--    longer recorded at all, per "zliczaj tylko zalogowanych". session_key is
--    intentionally left NULL on these new rows so the old
--    ad_events_one_impression_per_session unique index (keyed on session_key)
--    doesn't collapse a returning user's separate real visits into one row —
--    session bucketing now happens at query time in ad_stats() instead.
ALTER TABLE public.ad_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ad_events_user_idx ON public.ad_events (ad_id, user_id, created_at) WHERE user_id IS NOT NULL;

-- 3) Click throttle also needs to key off user_id now that logged-in events
--    carry no session_key.
CREATE OR REPLACE FUNCTION public.throttle_ad_click()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'click' AND NEW.session_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ad_events
      WHERE ad_id = NEW.ad_id AND session_key = NEW.session_key
        AND kind = 'click' AND created_at > now() - interval '3 seconds'
    ) THEN
      RAISE EXCEPTION 'rate limited';
    END IF;
  ELSIF NEW.kind = 'click' AND NEW.user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ad_events
      WHERE ad_id = NEW.ad_id AND user_id = NEW.user_id
        AND kind = 'click' AND created_at > now() - interval '3 seconds'
    ) THEN
      RAISE EXCEPTION 'rate limited';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Tighten INSERT: only authenticated, only your own user_id — the client
--    never sends anonymous events anymore, so the RLS layer now matches that
--    intent instead of merely hoping the client behaves.
DROP POLICY IF EXISTS "ad_events insert any" ON public.ad_events;
CREATE POLICY "ad_events insert own logged in"
  ON public.ad_events FOR INSERT TO authenticated
  WITH CHECK (kind IN ('impression','click') AND user_id = auth.uid());

-- 5) ad_stats(): add unique_users and sessions, logged-in only. A "session"
--    is one user's run of impressions on an ad with no gap over 30 minutes
--    between consecutive ones (classic gaps-and-islands sessionization) —
--    matches "jedno wejście na stronę i 30 min z jednego użytkownika".
-- Postgres won't let CREATE OR REPLACE change a function's OUT columns.
DROP FUNCTION IF EXISTS public.ad_stats();

CREATE FUNCTION public.ad_stats()
RETURNS TABLE (
  ad_id uuid,
  impressions bigint,
  clicks bigint,
  impressions_7d bigint,
  clicks_7d bigint,
  unique_users bigint,
  sessions bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gapped AS (
    SELECT
      e.ad_id,
      e.user_id,
      e.created_at,
      EXTRACT(EPOCH FROM (
        e.created_at - LAG(e.created_at) OVER (PARTITION BY e.ad_id, e.user_id ORDER BY e.created_at)
      )) / 60 AS gap_minutes
    FROM public.ad_events e
    WHERE e.kind = 'impression' AND e.user_id IS NOT NULL
  ),
  sessioned AS (
    SELECT
      ad_id,
      user_id,
      SUM(CASE WHEN gap_minutes IS NULL OR gap_minutes > 30 THEN 1 ELSE 0 END)
        OVER (PARTITION BY ad_id, user_id ORDER BY created_at) AS session_num
    FROM gapped
  )
  SELECT
    a.id AS ad_id,
    COUNT(*) FILTER (WHERE e.kind = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE e.kind = 'click') AS clicks,
    COUNT(*) FILTER (WHERE e.kind = 'impression' AND e.created_at > now() - interval '7 days') AS impressions_7d,
    COUNT(*) FILTER (WHERE e.kind = 'click' AND e.created_at > now() - interval '7 days') AS clicks_7d,
    (SELECT COUNT(DISTINCT s.user_id) FROM sessioned s WHERE s.ad_id = a.id) AS unique_users,
    (SELECT COUNT(*) FROM (SELECT DISTINCT user_id, session_num FROM sessioned s WHERE s.ad_id = a.id) x) AS sessions
  FROM public.ads a
  LEFT JOIN public.ad_events e ON e.ad_id = a.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  GROUP BY a.id;
$$;
