-- Czwarta i ostatnia tura z audytu RLS/SECURITY DEFINER. Zamyka piec pozycji,
-- ktore zostaly po turach 20260916130000, 20260925120000 i 20260925130000.

-- ── 1. Listy miejsc: prywatnosc BEZ psucia dzielenia sie linkiem ────────
-- Tura 2 swiadomie nie ruszyla place_lists, bo listy otwiera sie publicznym
-- linkiem /l/<id>, a tabela nie ma kolumny is_public - zamkniecie odczytu
-- zepsuloby te funkcje. Rozwiazanie nie wymaga wyboru miedzy jednym a drugim:
-- polityka tabelowa idzie ta sama regula co reszta ("wlasciciel / znajomy /
-- profil publiczny"), a dostep po linku zalatwia funkcja, dla ktorej UUID
-- listy JEST kluczem - kto zna link, ten widzi; enumeracja calej tabeli
-- przestaje dzialac. To zamyka tez niespojnosc z obietnica w Ustawieniach
-- ("Tylko Twoi znajomi widza wall i listy miejsc"), bo sciana zostala
-- zamknieta w turze 2, a listy nie.
DROP POLICY IF EXISTS "place_lists public read" ON public.place_lists;
CREATE POLICY "place_lists read own public or friend" ON public.place_lists
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = place_lists.user_id AND p.is_public = true)
  );

DROP POLICY IF EXISTS "place_list_items public read" ON public.place_list_items;
CREATE POLICY "place_list_items read via list" ON public.place_list_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.place_lists l
    WHERE l.id = place_list_items.list_id
      AND (
        l.user_id = auth.uid()
        OR public.is_friend_with(l.user_id)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.user_id AND p.is_public = true)
      )
  ));

-- Dostep po linku. Przyjmuje konkretne id - nie da sie nia wylistowac tabeli.
CREATE OR REPLACE FUNCTION public.get_shared_list(_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  cover_image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.user_id, l.title, l.description, l.cover_image_url,
         l.created_at, l.updated_at
  FROM public.place_lists l
  WHERE l.id = _id;
$$;

REVOKE ALL ON FUNCTION public.get_shared_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_list_items(_id uuid)
RETURNS TABLE (
  id uuid,
  list_id uuid,
  place_id uuid,
  note text,
  sort_order int,
  added_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.list_id, i.place_id, i.note, i.sort_order, i.added_at
  FROM public.place_list_items i
  WHERE i.list_id = _id
  ORDER BY i.sort_order;
$$;

REVOKE ALL ON FUNCTION public.get_shared_list_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list_items(uuid) TO anon, authenticated;

-- ── 2. Limit wysylek z formularza wspolpracy ────────────────────────────
-- Tura 3 wycieła tresc zglaszajacego z maila, wiec nie da sie juz nim wyslac
-- phishingu - ale samego mail-bombingu (ten sam adres w kolko) nic nie
-- blokowalo, bo caly antyspam (honeypot, elapsed_ms) pochodzil z inputu
-- klienta. Ten limit siedzi w bazie i klient nie ma na niego wplywu.
CREATE TABLE IF NOT EXISTS public.collab_send_log (
  id bigserial PRIMARY KEY,
  email_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_send_log_hash_time
  ON public.collab_send_log (email_hash, created_at DESC);

ALTER TABLE public.collab_send_log ENABLE ROW LEVEL SECURITY;
-- Celowo zero polityk: tabela jest dostepna wylacznie dla service_role.

CREATE OR REPLACE FUNCTION public.collab_send_allowed(_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_recent int;
  v_global int;
BEGIN
  -- md5 zamiast digest(): pgcrypto nie musi byc w search_path, a tu chodzi
  -- tylko o to, zeby nie trzymac adresow e-mail w logu limitera.
  v_hash := md5(lower(btrim(_email)));

  SELECT count(*) INTO v_recent FROM public.collab_send_log
   WHERE email_hash = v_hash AND created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_global FROM public.collab_send_log
   WHERE created_at >= now() - interval '1 hour';

  IF v_recent >= 1 OR v_global >= 30 THEN
    RETURN false;
  END IF;

  INSERT INTO public.collab_send_log (email_hash) VALUES (v_hash);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.collab_send_allowed(text) FROM PUBLIC, anon, authenticated;

-- ── 3. Glosowanie: lokal spoza kategorii i lokal nieopublikowany ────────
-- Funkcja sprawdzala, czy kuchnia nalezy do wydarzenia, ale nie czy WYBRANY
-- LOKAL w ogole jest z tej kuchni i czy jest opublikowany. Dalo sie oddac
-- glos na szkic albo wepchnac kebab do kategorii "Sushi".
-- Klient laczy je po nazwie kuchni (places.cuisine to tekst, nie klucz obcy),
-- wiec baza sprawdza dokladnie to samo powiazanie.
CREATE OR REPLACE FUNCTION public.submit_award_ballot(_event_id uuid, _picks jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_cuisine_ids uuid[];
  v_pick record;
  v_cuisine_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT status, cuisine_ids INTO v_status, v_cuisine_ids
  FROM public.awards_events WHERE id = _event_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'event_not_active';
  END IF;

  IF EXISTS (SELECT 1 FROM public.award_ballots WHERE event_id = _event_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  FOR v_pick IN SELECT * FROM jsonb_to_recordset(_picks) AS x(cuisine_id uuid, place_id uuid) LOOP
    IF v_pick.cuisine_id IS NULL OR v_pick.place_id IS NULL OR NOT (v_pick.cuisine_id = ANY (v_cuisine_ids)) THEN
      RAISE EXCEPTION 'invalid_pick';
    END IF;

    SELECT name INTO v_cuisine_name FROM public.cuisines
    WHERE id = v_pick.cuisine_id AND enabled = true;
    IF v_cuisine_name IS NULL THEN
      RAISE EXCEPTION 'invalid_pick';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = v_pick.place_id
        AND p.is_published = true
        AND p.cuisine = v_cuisine_name
    ) THEN
      RAISE EXCEPTION 'invalid_pick';
    END IF;

    INSERT INTO public.award_votes (event_id, user_id, cuisine_id, place_id)
    VALUES (_event_id, v_uid, v_pick.cuisine_id, v_pick.place_id)
    ON CONFLICT (event_id, user_id, cuisine_id) DO UPDATE SET place_id = EXCLUDED.place_id, updated_at = now();
  END LOOP;

  INSERT INTO public.award_ballots (event_id, user_id) VALUES (_event_id, v_uid);
END $$;

-- ── 4. Wyscig na dziennym limicie punktow ───────────────────────────────
-- Komentarz w 20260915120000 obiecywal "same transaction, row-locked", ale nic
-- nie bylo blokowane: dwa rownolegle zadania liczyly wiersze zanim ktorekolwiek
-- zdazylo dopisac swoj, wiec oba widzialy count < cap i oba nagradzaly.
-- Blokada doradcza na (uzytkownik, zdarzenie) serializuje tylko te pary, ktore
-- faktycznie rywalizuja o ten sam limit - nie dotyka innych uzytkownikow.
CREATE OR REPLACE FUNCTION public.points_daily_cap_reached(
  _user_id uuid, _event_key text, _cap_key text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cap int;
  v_count int;
BEGIN
  SELECT points INTO v_cap FROM public.points_rules
  WHERE event_key = _cap_key AND enabled = true;
  IF v_cap IS NULL THEN RETURN false; END IF;

  -- Trzymana do konca transakcji, wiec rownolegle zadanie tego samego
  -- uzytkownika czeka i policzy juz dopisany wiersz.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _event_key, 0));

  SELECT count(*) INTO v_count
  FROM public.points_transactions
  WHERE user_id = _user_id
    AND event_key = _event_key
    AND points > 0
    AND created_at >= now() - interval '24 hours';

  RETURN v_count >= v_cap;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.points_daily_cap_reached(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ── 5. Statystyki reklam: throttle obchodzony losowym session_key ───────
-- session_key przychodzi z klienta, wiec losujac go przy kazdym zadaniu mozna
-- bylo pompowac liczniki. Dla zalogowanych da sie to domknac twardo: throttle
-- po user_id stosujemy ZAWSZE, nie tylko gdy session_key jest pusty (dotad
-- ELSIF sprawiał, że wystarczyło podać session_key, by ominąć kontrolę konta).
-- Dla niezalogowanych zostaje sufit globalny na reklame - nie odtworzy
-- prawdziwej liczby unikalnych osob, ale ogranicza skale zawyzania.
CREATE OR REPLACE FUNCTION public.throttle_ad_click()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.kind <> 'click' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ad_events
    WHERE ad_id = NEW.ad_id AND user_id = NEW.user_id
      AND kind = 'click' AND created_at > now() - interval '3 seconds'
  ) THEN
    RAISE EXCEPTION 'rate limited';
  END IF;

  IF NEW.session_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ad_events
    WHERE ad_id = NEW.ad_id AND session_key = NEW.session_key
      AND kind = 'click' AND created_at > now() - interval '3 seconds'
  ) THEN
    RAISE EXCEPTION 'rate limited';
  END IF;

  -- Sufit dla ruchu niezalogowanego: 60 klikniec na reklame na minute.
  IF NEW.user_id IS NULL AND (
    SELECT count(*) FROM public.ad_events
    WHERE ad_id = NEW.ad_id AND user_id IS NULL
      AND kind = 'click' AND created_at > now() - interval '1 minute'
  ) >= 60 THEN
    RAISE EXCEPTION 'rate limited';
  END IF;

  RETURN NEW;
END;
$$;
