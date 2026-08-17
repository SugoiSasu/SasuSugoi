-- 1) Places slug
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(_input, ''),
            'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
            'acelnoszzacelnoszz'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

-- Backfill, with collision suffix
DO $$
DECLARE r record; base text; candidate text; i int;
BEGIN
  FOR r IN SELECT id, name FROM public.places WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base IS NULL OR base = '' THEN base := 'lokal'; END IF;
    candidate := base; i := 1;
    WHILE EXISTS (SELECT 1 FROM public.places WHERE slug = candidate AND id <> r.id) LOOP
      i := i + 1; candidate := base || '-' || i;
    END LOOP;
    UPDATE public.places SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.places ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS places_slug_unique ON public.places(slug);

CREATE OR REPLACE FUNCTION public.places_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE base text; candidate text; i int;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.slugify(NEW.name);
    IF base IS NULL OR base = '' THEN base := 'lokal'; END IF;
    candidate := base; i := 1;
    WHILE EXISTS (SELECT 1 FROM public.places WHERE slug = candidate AND id <> NEW.id) LOOP
      i := i + 1; candidate := base || '-' || i;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS places_set_slug_trg ON public.places;
CREATE TRIGGER places_set_slug_trg BEFORE INSERT OR UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.places_set_slug();

-- 2) Profile social links
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url    text,
  ADD COLUMN IF NOT EXISTS youtube_url   text,
  ADD COLUMN IF NOT EXISTS facebook_url  text,
  ADD COLUMN IF NOT EXISTS x_url         text;

-- 3) Site settings (alpha gate)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings super manage" ON public.site_settings;
CREATE POLICY "site_settings super manage" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.site_settings(key, value)
VALUES ('alpha_gate', jsonb_build_object('enabled', false, 'password', 'pozeramy'))
ON CONFLICT (key) DO NOTHING;

-- Public RPC: is the gate enabled? (no password leakage)
CREATE OR REPLACE FUNCTION public.alpha_gate_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false)
  FROM public.site_settings WHERE key = 'alpha_gate';
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_enabled() TO anon, authenticated;

-- Public RPC: verify password
CREATE OR REPLACE FUNCTION public.alpha_gate_verify(_password text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.site_settings
    WHERE key = 'alpha_gate'
      AND COALESCE((value->>'enabled')::boolean, false) = false
  ) OR EXISTS(
    SELECT 1 FROM public.site_settings
    WHERE key = 'alpha_gate'
      AND value->>'password' = _password
  );
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_verify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_verify(text) TO anon, authenticated;

-- Read full settings (head admin only)
CREATE OR REPLACE FUNCTION public.alpha_gate_get()
RETURNS TABLE(enabled boolean, password text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((value->>'enabled')::boolean, false) AS enabled,
    COALESCE(value->>'password', '') AS password
  FROM public.site_settings
  WHERE key = 'alpha_gate'
    AND public.has_role(auth.uid(), 'super_admin');
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_get() TO authenticated;

-- Update settings (head admin only)
CREATE OR REPLACE FUNCTION public.alpha_gate_set(_enabled boolean, _password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.site_settings
    SET value = jsonb_build_object('enabled', _enabled, 'password', _password),
        updated_at = now()
  WHERE key = 'alpha_gate';
END $$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) TO authenticated;

