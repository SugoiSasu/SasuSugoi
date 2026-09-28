-- Automatyczny nick zalezny od plci: pozeracz#### / pozeraczka####.
--
-- Mateusz (2026-09-28): nick zastepczy musi rozrozniac pozeracza i pozeraczke.
--
-- Plec bywa nieznana w chwili zakladania konta (Google jej nie podaje), wiec
-- sa trzy miejsca:
--  1. generate_username(_name, _gender) - przy rejestracji, gdy plec jest w
--     metadanych konta (formularz e-mail ja teraz tam przekazuje).
--  2. Trigger na profiles: ustawienie plci pozniej (powitanie, Ustawienia)
--     zamienia forme nicku - ale TYLKO nicku zastepczego w nietknietej postaci
--     (^pozeracz\d{4}$ / ^pozeraczka\d{4}$). Nick wybrany przez uzytkownika
--     nigdy nie jest ruszany. Cyfry zostaja te same, jesli wolne.
--  3. Nadrobienie dla istniejacych kont.
--
-- Przy okazji: formularz rejestracji zapisywal plec UPDATE-em profilu zaraz po
-- signUp, a przy wlaczonym potwierdzaniu e-maila nie ma wtedy sesji - zapis
-- przepadal po cichu. Teraz plec idzie w metadanych i wpisuje ja
-- handle_new_user.

-- Stara jednoargumentowa wersja musi zniknac: z nowa (z domyslnym NULL) wolanie
-- z jednym argumentem byloby niejednoznaczne.
DROP FUNCTION IF EXISTS public.generate_username(text);

CREATE OR REPLACE FUNCTION public.generate_username(_name text, _gender text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rdzen text;
  v_kandydat text;
  v_n int := 1;
  v_proby int := 0;
  v_slowo text := CASE WHEN _gender = 'K' THEN 'pozeraczka' ELSE 'pozeracz' END;
BEGIN
  v_rdzen := lower(translate(coalesce(_name, ''), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz'));
  v_rdzen := regexp_replace(v_rdzen, '[^a-z0-9]+', '_', 'g');
  -- 14 znakow na rdzen zostawia miejsce na przyrostek liczbowy do 20.
  v_rdzen := trim(both '_' from left(trim(both '_' from v_rdzen), 14));

  IF length(v_rdzen) >= 3 THEN
    v_kandydat := v_rdzen;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_kandydat) LOOP
      v_n := v_n + 1;
      IF v_n > 99999 THEN
        v_kandydat := NULL;
        EXIT;
      END IF;
      v_kandydat := v_rdzen || v_n::text;
    END LOOP;
    IF v_kandydat IS NOT NULL THEN
      RETURN v_kandydat;
    END IF;
  END IF;

  -- Brak uzytecznego imienia: losowe cyfry, NIE kolejne (kolejne zdradzalyby
  -- liczbe kont). "pozeraczka" + 4 cyfry = 14 znakow, miesci sie w 20.
  LOOP
    v_kandydat := v_slowo || (1000 + floor(random() * 9000))::int::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_kandydat);
    v_proby := v_proby + 1;
    IF v_proby > 50 THEN
      v_kandydat := 'p' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_kandydat;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_username(text, text) FROM PUBLIC, anon, authenticated;

-- handle_new_user: tresc z 20260928120000 + plec z metadanych.
-- AFTER INSERT ON auth.users - kazdy blad tu wywraca rejestracje, stad
-- zabezpieczenia jak poprzednio.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avatar text;
  v_source text := 'initials';
  v_name text;
  v_username text;
  v_gender text;
BEGIN
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  IF v_avatar IS NOT NULL THEN
    v_source := 'google';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  );
  -- Never use raw email as display_name (privacy).
  IF v_name IS NULL OR v_name ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    v_name := NULL;
  END IF;

  -- Metadane wpisuje klient - przyjmujemy tylko dwie znane wartosci.
  v_gender := NEW.raw_user_meta_data->>'gender';
  IF v_gender IS DISTINCT FROM 'M' AND v_gender IS DISTINCT FROM 'K' THEN
    v_gender := NULL;
  END IF;

  BEGIN
    v_username := public.generate_username(v_name, v_gender);
  EXCEPTION WHEN OTHERS THEN
    v_username := NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source, username, gender)
    VALUES (NEW.id, v_name, v_avatar, v_source, v_username, v_gender)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation OR check_violation THEN
    INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source, gender)
    VALUES (NEW.id, v_name, v_avatar, v_source, v_gender)
    ON CONFLICT (id) DO NOTHING;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── Zmiana plci pozniej -> forma nicku zastepczego ─────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_gendered_auto_username()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cyfry text;
  v_slowo text;
  v_kandydat text;
  v_proby int := 0;
BEGIN
  -- Uzytkownik w tym samym zapisie zmienia nick sam - jego wybor wygrywa.
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;
  IF NEW.username !~ '^pozeracz(ka)?\d{4}$' THEN
    RETURN NEW; -- nick wlasny, nie zastepczy
  END IF;
  IF NEW.gender IS NULL THEN
    RETURN NEW; -- wyczyszczona plec: nie zgadujemy, zostaje obecna forma
  END IF;

  v_slowo := CASE WHEN NEW.gender = 'K' THEN 'pozeraczka' ELSE 'pozeracz' END;
  IF NEW.username ~ ('^' || v_slowo || '\d{4}$') THEN
    RETURN NEW; -- juz wlasciwa forma
  END IF;

  v_cyfry := substring(NEW.username from '(\d{4})$');
  v_kandydat := v_slowo || v_cyfry;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_kandydat AND id <> NEW.id) LOOP
    v_proby := v_proby + 1;
    IF v_proby > 50 THEN
      RETURN NEW; -- nie da sie - zostaje stary nick, nic sie nie psuje
    END IF;
    v_kandydat := v_slowo || (1000 + floor(random() * 9000))::int::text;
  END LOOP;
  NEW.username := v_kandydat;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profiles_gendered_auto_username() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_gendered_auto_username ON public.profiles;
CREATE TRIGGER profiles_gendered_auto_username
  BEFORE UPDATE OF gender ON public.profiles
  FOR EACH ROW
  WHEN (OLD.gender IS DISTINCT FROM NEW.gender)
  EXECUTE FUNCTION public.profiles_gendered_auto_username();

-- ── Nadrobienie: kobiety z nickiem zastepczym w formie meskiej ─────────────
DO $$
DECLARE r record; v_nowy text; v_proby int;
BEGIN
  FOR r IN
    SELECT id, username FROM public.profiles
    WHERE gender = 'K' AND username ~ '^pozeracz\d{4}$'
  LOOP
    v_nowy := 'pozeraczka' || substring(r.username from '(\d{4})$');
    v_proby := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_nowy) AND v_proby < 50 LOOP
      v_nowy := 'pozeraczka' || (1000 + floor(random() * 9000))::int::text;
      v_proby := v_proby + 1;
    END LOOP;
    IF v_proby < 50 THEN
      UPDATE public.profiles SET username = v_nowy WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Nick zastepczy zalezny od plci (pozeracz/pozeraczka), plec zapisywana juz przy rejestracji e-mailem.');
