-- ad_events INSERT is open to anon/authenticated with no rate limiting —
-- anyone can script-spam impression/click rows to skew ad_stats(). Two
-- lightweight, fail-safe guards (the client already fire-and-forgets these
-- inserts without handling errors, so a rejected duplicate/rapid row is
-- silently and correctly just not counted):
--
-- 1) One impression per (ad, session) ever — a partial unique index.
-- 2) Clicks from the same (ad, session) throttled to one per 3 seconds.

CREATE UNIQUE INDEX IF NOT EXISTS ad_events_one_impression_per_session
  ON public.ad_events (ad_id, session_key)
  WHERE kind = 'impression' AND session_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.throttle_ad_click()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'click' AND NEW.session_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ad_events
      WHERE ad_id = NEW.ad_id
        AND session_key = NEW.session_key
        AND kind = 'click'
        AND created_at > now() - interval '3 seconds'
    ) THEN
      RAISE EXCEPTION 'rate limited';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_events_throttle_click ON public.ad_events;
CREATE TRIGGER ad_events_throttle_click
  BEFORE INSERT ON public.ad_events
  FOR EACH ROW EXECUTE FUNCTION public.throttle_ad_click();
