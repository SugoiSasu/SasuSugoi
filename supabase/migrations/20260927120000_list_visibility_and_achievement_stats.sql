-- Podklad pod dwa nowe ekrany z paczki designu (06_osiagniecia, 07_moje_miejsca).
--
-- 1) Widocznosc list: Publiczna / Znajomi / Prywatna.
-- 2) achievement_stats(): ilu ludzi ma kazda odznake i ilu jest graczy - zeby
--    rzadkosc liczyla sie sama, zamiast byc wklepywana recznie przy 71 odznakach.

-- ── 1. place_lists.visibility ──────────────────────────────────────────────
-- Domyslnie 'public', bo taki jest DZISIEJSZY stan: polityka z rundy 4
-- zamyka listowanie tabeli, ale kto ma link, ten liste otwiera. Gdyby dac
-- domyslnie 'private', wszystkie juz rozeslane linki przestalyby dzialac z
-- dnia na dzien i nikt by nie wiedzial dlaczego.
ALTER TABLE public.place_lists
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.place_lists
  DROP CONSTRAINT IF EXISTS place_lists_visibility_check;
ALTER TABLE public.place_lists
  ADD CONSTRAINT place_lists_visibility_check
  CHECK (visibility IN ('public', 'friends', 'private'));

-- Widocznosc egzekwujemy w get_shared_list/get_shared_list_items, a nie w
-- polityce SELECT. Polityka na place_lists zostaje zacisnieta do wlasciciela
-- (runda 4) - te dwie funkcje sa jedyna droga do cudzej listy, wiec jeden
-- warunek w jednym miejscu zamiast dwoch, ktore moga sie rozjechac.
CREATE OR REPLACE FUNCTION public.list_is_visible_to_me(_list_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.place_lists l
    WHERE l.id = _list_id
      AND (
        l.user_id = auth.uid()
        OR l.visibility = 'public'
        OR (l.visibility = 'friends'
            AND auth.uid() IS NOT NULL
            AND public.are_friends(l.user_id, auth.uid()))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.list_is_visible_to_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_is_visible_to_me(uuid) TO anon, authenticated;

-- Doszla kolumna `visibility` w wyniku, a Postgres nie pozwala zmienic typu
-- zwracanego przez CREATE OR REPLACE - stad DROP. Uprawnienia odtwarzamy
-- ponizej, bo DROP zabiera je razem z funkcja.
DROP FUNCTION IF EXISTS public.get_shared_list(uuid);

CREATE OR REPLACE FUNCTION public.get_shared_list(_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  cover_image_url text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.user_id, l.title, l.description, l.cover_image_url,
         l.visibility, l.created_at, l.updated_at
  FROM public.place_lists l
  WHERE l.id = _id
    AND public.list_is_visible_to_me(l.id);
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
    AND public.list_is_visible_to_me(i.list_id)
  ORDER BY i.sort_order, i.added_at;
$$;

REVOKE ALL ON FUNCTION public.get_shared_list_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list_items(uuid) TO anon, authenticated;

-- Listy znajomych do przegladania ("Moje listy" pokazuje tez cudze publiczne).
-- Zwraca sam naglowek listy + licznik miejsc; zawartosc dalej idzie przez
-- get_shared_list_items, wiec jeden warunek widocznosci obowiazuje wszedzie.
CREATE OR REPLACE FUNCTION public.visible_lists(_owner uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  cover_image_url text,
  visibility text,
  places_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.user_id, l.title, l.description, l.cover_image_url,
         l.visibility,
         (SELECT count(*) FROM public.place_list_items i WHERE i.list_id = l.id)::bigint,
         l.created_at, l.updated_at
  FROM public.place_lists l
  WHERE (_owner IS NULL OR l.user_id = _owner)
    AND public.list_is_visible_to_me(l.id)
  ORDER BY l.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.visible_lists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visible_lists(uuid) TO anon, authenticated;

-- ── 2. achievement_stats() ─────────────────────────────────────────────────
-- SECURITY DEFINER, bo user_achievements ma warstwe "tylko znajomi" - bez tego
-- licznik pokazywalby tylko wlasne i znajomych. Zwraca WYLACZNIE agregaty,
-- zadnego user_id, wiec nie odslania, KTO ma dana odznake.
CREATE OR REPLACE FUNCTION public.achievement_stats()
RETURNS TABLE (
  achievement_id uuid,
  holders bigint,
  total_players bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id,
         COALESCE(h.n, 0)::bigint,
         (SELECT count(*) FROM public.profiles)::bigint
  FROM public.achievements a
  LEFT JOIN (
    SELECT ua.achievement_id, count(DISTINCT ua.user_id) AS n
    FROM public.user_achievements ua
    GROUP BY ua.achievement_id
  ) h ON h.achievement_id = a.id
  WHERE a.enabled;
$$;

REVOKE ALL ON FUNCTION public.achievement_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.achievement_stats() TO anon, authenticated;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Listy: widocznosc Publiczna/Znajomi/Prywatna + funkcja visible_lists. Odznaki: achievement_stats() do liczenia rzadkosci.');
