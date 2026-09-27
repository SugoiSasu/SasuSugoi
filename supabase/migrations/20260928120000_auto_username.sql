-- Automatyczny nick przy zakladaniu konta.
--
-- Nick (profiles.username) nie byl nadawany NIGDY - ani przy rejestracji
-- e-mailem, ani przez Google (tam w ogole nie ma formularza). 6 z 10 kont go
-- nie mialo, stad "@null" w interfejsie i profile bez adresu /u/<nick>.
--
-- Decyzja Mateusza (2026-09-28): nick nadawany automatycznie, plus zacheta do
-- zmiany w oknie powitalnym.
--
-- Zrodlo nicku: imie z konta (Google podaje full_name/name). NIE poczatek
-- e-maila - "jan_kowalski" z jan.kowalski@gmail.com zdradza wiekszosc adresu,
-- a handle_new_user juz dzis celowo nie wstawia e-maila jako nazwy
-- ("Never use raw email as display_name (privacy)"). Konto bez imienia
-- dostaje neutralne "pozeracz" + cztery losowe cyfry.
--
-- Format musi spelniac istniejacy CHECK: ^[a-z0-9_]{3,20}$ oraz unikalny
-- indeks na lower(username).

CREATE OR REPLACE FUNCTION public.generate_username(_name text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rdzen text;
  v_kandydat text;
  v_n int := 1;
  v_proby int := 0;
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
  -- liczbe kont).
  LOOP
    v_kandydat := 'pozeracz' || (1000 + floor(random() * 9000))::int::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_kandydat);
    v_proby := v_proby + 1;
    IF v_proby > 50 THEN
      -- Przy 9000 mozliwosciach i gestym zapelnieniu - dluzszy losowy ciag.
      v_kandydat := 'p' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_kandydat;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_username(text) FROM PUBLIC, anon, authenticated;

-- handle_new_user: tresc z 20260624112621 + nick.
-- Ten trigger dziala na AFTER INSERT ON auth.users: kazdy nieobsluzony blad
-- tutaj WYWRACA REJESTRACJE. Dlatego nick ma dwa poziomy zabezpieczen i
-- ostatecznie spada do NULL, czyli do dotychczasowego zachowania.
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

  BEGIN
    v_username := public.generate_username(v_name);
  EXCEPTION WHEN OTHERS THEN
    v_username := NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source, username)
    VALUES (NEW.id, v_name, v_avatar, v_source, v_username)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation OR check_violation THEN
    -- Wyscig: ktos w tej samej chwili dostal ten sam nick. Profil i tak musi
    -- powstac - bez nicku, jak przed ta migracja.
    INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source)
    VALUES (NEW.id, v_name, v_avatar, v_source)
    ON CONFLICT (id) DO NOTHING;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Nadrobienie dla istniejacych kont bez nicku. Flaga na wypadek, gdyby
-- straznik kolumn uprzywilejowanych obejmowal username - bez niej UPDATE
-- zostalby po cichu cofniety (ta sama pulapka co przy points_total).
DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
  FOR r IN SELECT id, display_name FROM public.profiles WHERE username IS NULL LOOP
    BEGIN
      UPDATE public.profiles
      SET username = public.generate_username(r.display_name)
      WHERE id = r.id AND username IS NULL;
    EXCEPTION WHEN unique_violation OR check_violation THEN
      NULL; -- jedno konto bez nicku nie moze przerwac reszty
    END;
  END LOOP;
END $$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Automatyczny nick przy rejestracji (z imienia albo pozeracz+cyfry, nigdy z e-maila) + nadrobienie dla kont bez nicku.');
