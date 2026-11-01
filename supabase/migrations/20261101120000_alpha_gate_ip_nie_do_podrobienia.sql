-- Limit prob hasla bramki alfa liczyl sie po PIERWSZYM adresie z X-Forwarded-For,
-- a ten klient moze wpisac sam (kazda proba z innym adresem = brak limitu).
-- Teraz: cf-connecting-ip (ustawia Cloudflare przed Supabase, klient go nie nadpisze),
-- a awaryjnie OSTATNI element X-Forwarded-For (dopisany przez najblizszy proxy).
CREATE OR REPLACE FUNCTION public.alpha_gate_verify(_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_hash text;
  v_klucz text;
  v_naglowki json;
  v_xff text;
  v_proby int;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean, false), value->>'password_hash'
    INTO v_enabled, v_hash
  FROM public.site_settings WHERE key = 'alpha_gate';
  -- Bramka wylaczona = wpuszczamy (jak dotad).
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN true;
  END IF;
  BEGIN
    v_naglowki := current_setting('request.headers', true)::json;
    v_xff := coalesce(v_naglowki->>'x-forwarded-for', '');
    v_klucz := coalesce(
      nullif(btrim(v_naglowki->>'cf-connecting-ip'), ''),
      nullif(btrim(v_naglowki->>'x-real-ip'), ''),
      nullif(btrim((string_to_array(v_xff, ','))[array_length(string_to_array(v_xff, ','), 1)]), '')
    );
  EXCEPTION WHEN others THEN
    v_klucz := NULL;
  END;
  v_klucz := coalesce(v_klucz, 'nieznany');
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
END $function$;

-- Zachowaj dotychczasowe uprawnienia (anon i authenticated wolaja bramke).
GRANT EXECUTE ON FUNCTION public.alpha_gate_verify(text) TO anon, authenticated;
