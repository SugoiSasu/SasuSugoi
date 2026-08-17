-- 1) Naprawa Data API GRANTs dla tabeli ads (brakowały, stąd "Failed to fetch")
GRANT SELECT ON public.ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;

-- 2) Tabela zdarzeń reklamowych: wyświetlenia i kliknięcia
CREATE TABLE IF NOT EXISTS public.ad_events (
  id bigserial PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_events_ad_kind_idx ON public.ad_events (ad_id, kind);
CREATE INDEX IF NOT EXISTS ad_events_created_at_idx ON public.ad_events (created_at DESC);

GRANT SELECT, INSERT ON public.ad_events TO anon;
GRANT SELECT, INSERT ON public.ad_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ad_events_id_seq TO anon, authenticated;
GRANT ALL ON public.ad_events TO service_role;
GRANT ALL ON SEQUENCE public.ad_events_id_seq TO service_role;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

-- Każdy (także anonim) może wstawić zdarzenie — tylko impression/click, nic więcej
CREATE POLICY "ad_events insert any"
  ON public.ad_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (kind IN ('impression','click'));

-- Tylko super_admin czyta surowe zdarzenia
CREATE POLICY "ad_events super read"
  ON public.ad_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) Agregat statystyk dostępny dla super_admin
CREATE OR REPLACE FUNCTION public.ad_stats()
RETURNS TABLE (
  ad_id uuid,
  impressions bigint,
  clicks bigint,
  impressions_7d bigint,
  clicks_7d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS ad_id,
    COUNT(*) FILTER (WHERE e.kind = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE e.kind = 'click') AS clicks,
    COUNT(*) FILTER (WHERE e.kind = 'impression' AND e.created_at > now() - interval '7 days') AS impressions_7d,
    COUNT(*) FILTER (WHERE e.kind = 'click' AND e.created_at > now() - interval '7 days') AS clicks_7d
  FROM public.ads a
  LEFT JOIN public.ad_events e ON e.ad_id = a.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  GROUP BY a.id;
$$;

GRANT EXECUTE ON FUNCTION public.ad_stats() TO authenticated;

