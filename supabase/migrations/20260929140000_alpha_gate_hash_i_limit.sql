-- Bramka alpha: haslo haszowane (bcrypt) zamiast jawnego tekstu w site_settings
-- + limit nieudanych prob na adres IP. Wczesniej sprawdzenie nie mialo zadnego
-- limitu, wiec anonimowy gosc mogl zgadywac haslo bez ograniczen.

CREATE TABLE IF NOT EXISTS public.alpha_gate_attempts (
  id bigserial PRIMARY KEY,
  klucz text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alpha_gate_attempts_klucz_at_idx ON public.alpha_gate_attempts (klucz, at DESC);
ALTER TABLE public.alpha_gate_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alpha_gate_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.alpha_gate_attempts TO service_role;

-- Migracja istniejacego hasla: jawny tekst -> hash, pole "password" znika.
UPDATE public.site_settings
SET value = (value - 'password') || jsonb_build_object(
      'password_hash', extensions.crypt(value->>'password', extensions.gen_salt('bf', 10))),
    updated_at = now()
WHERE key = 'alpha_gate'
  AND value ? 'password'
  AND coalesce(value->>'password', '') <> '';

UPDATE public.site_settings
SET value = value - 'password'
WHERE key = 'alpha_gate' AND value ? 'password';

DROP FUNCTION IF EXISTS public.alpha_gate_get();
CREATE FUNCTION public.alpha_gate_get()
RETURNS TABLE(enabled boolean, has_password boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((value->>'enabled')::boolean, false),
    COALESCE(value->>'password_hash', '') <> ''
  FROM public.site_settings
  WHERE key = 'alpha_gate'
    AND public.has_role(auth.uid(), 'super_admin');
$$;
REVOKE ALL ON FUNCTION public.alpha_gate_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_get() TO authenticated;

-- Puste _password = zostaw obecne haslo (UI nie zna juz jawnego tekstu).
CREATE OR REPLACE FUNCTION public.alpha_gate_set(_enabled boolean, _password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_hash text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(btrim(_password), '') <> '' THEN
    v_hash := extensions.crypt(_password, extensions.gen_salt('bf', 10));
  ELSE
    SELECT value->>'password_hash' INTO v_hash FROM public.site_settings WHERE key = 'alpha_gate';
  END IF;
  IF _enabled AND coalesce(v_hash, '') = '' THEN
    RAISE EXCEPTION 'Ustaw hasło, zanim włączysz bramkę';
  END IF;
  UPDATE public.site_settings
    SET value = jsonb_build_object('enabled', _enabled, 'password_hash', coalesce(v_hash, '')),
        updated_at = now()
  WHERE key = 'alpha_gate';
END $$;
REVOKE ALL ON FUNCTION public.alpha_gate_set(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.alpha_gate_verify(_password text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_hash text;
  v_klucz text;
  v_proby int;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean, false), value->>'password_hash'
    INTO v_enabled, v_hash
  FROM public.site_settings WHERE key = 'alpha_gate';
  -- Bramka wylaczona = wpuszczamy (jak dotad).
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN true;
  END IF;

  -- Klucz limitu: pierwszy adres z X-Forwarded-For (PostgREST za proxy).
  BEGIN
    v_klucz := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  EXCEPTION WHEN others THEN
    v_klucz := '';
  END;
  v_klucz := coalesce(nullif(btrim(v_klucz), ''), 'nieznany');

  SELECT count(*) INTO v_proby FROM public.alpha_gate_attempts
  WHERE klucz = v_klucz AND at > now() - interval '10 minutes';
  IF v_proby >= 8 THEN
    RAISE EXCEPTION 'Za dużo prób. Spróbuj za kilka minut.' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(v_hash, '') <> '' AND v_hash = extensions.crypt(coalesce(_password, ''), v_hash) THEN
    RETURN true;
  END IF;

  INSERT INTO public.alpha_gate_attempts (klucz) VALUES (v_klucz);
  DELETE FROM public.alpha_gate_attempts WHERE at < now() - interval '1 day';
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.alpha_gate_verify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_verify(text) TO anon, authenticated;
