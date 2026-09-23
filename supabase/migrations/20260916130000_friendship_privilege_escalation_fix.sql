-- PILNE: łatka bezpieczeństwa. Zweryfikowane na żywo 2026-09-16 na produkcji,
-- na jednorazowych kontach audit_ (usuniętych po teście).
--
-- Cała warstwa "tylko znajomi" z 20260820120000_friends_only_privacy_fix
-- (prywatny profil, place_visits, place_favorites, user_achievements) opiera
-- się na public.is_friend_with(), czyli na wierszu friendships ze statusem
-- 'accepted'. Ten wiersz dało się jednak sfabrykować bez zgody drugiej strony:
--
--   F1 (krytyczne) Polityka INSERT sprawdzała tylko auth.uid() = requester_id,
--      nie status. POST /rest/v1/friendships {requester_id: ja, addressee_id:
--      ofiara, status: 'accepted'} -> prywatny profil i wizyty ofiary stały się
--      czytelne (test: 0 -> 1 wiersz). Ofiara nie dostawała powiadomienia,
--      bo friendships_notify() reaguje tylko na INSERT ze statusem 'pending'.
--
--   F2 (wysokie) Polityka UPDATE pilnowała tylko addressee_id. Adresat
--      dowolnego zaproszenia (np. od własnego drugiego konta) mógł przepisać
--      requester_id na ofiarę i ustawić 'accepted' (test: przepisanie
--      przeszło, prywatny profil drugiej ofiary czytelny).
--
--   F3 (wysokie) search_users() dopasowywało auth.users.email przez ILIKE
--      '%...%' - wyrocznia pozwalająca odtworzyć adres e-mail znak po znaku
--      (test: zapytanie z fragmentem obecnym wyłącznie w e-mailu zwróciło
--      prywatną ofiarę). Nie respektowało też blokad, choć UI obiecuje
--      "Zablokowane osoby nie mogą Cię znaleźć".
--
--   F4 (średnie) friends_of() z GRANT-em dla anon zwracało znajomych
--      dowolnego użytkownika, także prywatnego (test: sam klucz anon, bez
--      konta, zwrócił listę). friend_leaderboard() i friend_activity_feed()
--      przyjmowały dowolne _user, więc zwykłe konto dostawało cudzy ranking
--      znajomych z punktami i cudzy feed recenzji.
--
-- Sprawdzone przed łatką: na produkcji jest 1 zaakceptowana znajomość i ma
-- responded_at (legalna ścieżka akceptacji) - brak śladów wykorzystania.
--
-- Zgodność z klientem (src/lib/friends-api.ts): zaproszenie wstawia tylko
-- requester_id/addressee_id (status domyślnie 'pending'), akceptacja zmienia
-- tylko status na 'accepted' + responded_at, odrzucenie to DELETE. Zaproszenia
-- z linku (accept_friend_invite) są SECURITY DEFINER i RLS ich nie dotyczy.
-- friend_leaderboard jest wołany wyłącznie z własnym id.

-- ── F1: zaproszenie może powstać wyłącznie jako 'pending' ─────────────────
DROP POLICY IF EXISTS "friendships requester insert" ON public.friendships;
CREATE POLICY "friendships requester insert" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> addressee_id
    AND status = 'pending'
  );

-- ── F2: adresat może tylko przyjąć oczekujące zaproszenie ─────────────────
DROP POLICY IF EXISTS "friendships addressee respond" ON public.friendships;
CREATE POLICY "friendships addressee respond" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');

-- WITH CHECK nie widzi starego wiersza, więc sama polityka nie zabroni
-- podmiany requester_id. Strony znajomości są niezmienne dla wszystkich,
-- także dla funkcji SECURITY DEFINER (żadna ich nie zmienia).
CREATE OR REPLACE FUNCTION public.friendships_guard_parties()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id THEN
    RAISE EXCEPTION 'friendship parties are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.friendships_guard_parties() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS friendships_guard_parties ON public.friendships;
CREATE TRIGGER friendships_guard_parties
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_guard_parties();

-- ── F3: wyszukiwarka bez wyroczni e-mail, z blokadami ─────────────────────
-- UI obiecuje wyszukiwanie "po nicku, imieniu lub e-mailu", więc e-mail
-- zostaje - ale tylko jako pełny adres (równość), nie podciąg. Znalezienie
-- znajomego po jego adresie działa dalej; odtwarzanie cudzego adresu po
-- fragmentach już nie. Profile prywatne pozostają wyszukiwalne (zwracana jest
-- tylko tożsamość: nick/nazwa/awatar), bo inaczej nie dałoby się ich zaprosić.
CREATE OR REPLACE FUNCTION public.search_users(_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_source text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.avatar_source::text
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(btrim(coalesce(_query, ''))) >= 2
    AND NOT public.is_blocked(auth.uid(), p.id)
    AND (
      p.username ILIKE '%' || _query || '%'
      OR p.display_name ILIKE '%' || _query || '%'
      OR (
        position('@' IN _query) > 0
        AND EXISTS (
          SELECT 1 FROM auth.users u
          WHERE u.id = p.id AND lower(u.email) = lower(btrim(_query))
        )
      )
    )
  LIMIT 25;
$$;

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- ── F4: graf znajomych tą samą regułą co reszta "tylko znajomi" ───────────
-- Anon zachowuje dostęp do list znajomych profili publicznych (strona /u/...).
CREATE OR REPLACE FUNCTION public.friends_of(_user uuid)
RETURNS TABLE(friend_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN f.requester_id = _user THEN f.addressee_id ELSE f.requester_id END
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = _user OR f.addressee_id = _user)
    AND (
      _user = auth.uid()
      OR public.is_friend_with(_user)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user AND p.is_public = true)
    );
$$;

-- Ranking znajomych i feed są z definicji "moje" - cudze _user nic nie zwraca.
-- Ciało friend_leaderboard jak w 20260825070000_lol_style_titles.sql + warunek.
CREATE OR REPLACE FUNCTION public.friend_leaderboard(_user uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  avatar_source text,
  is_vip boolean,
  vip_until timestamptz,
  vip_nick_color text,
  active_title text,
  points_total int,
  reviews_count int,
  achievements_count int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT _user AS uid
    UNION
    SELECT friend_id FROM public.friends_of(_user)
  )
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.avatar_source,
    COALESCE(p.is_vip, false),
    p.vip_until,
    p.vip_nick_color,
    p.active_title,
    COALESCE(p.points_total, 0)::int,
    (SELECT count(*)::int FROM public.reviews r WHERE r.user_id = p.id),
    (SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = p.id)
  FROM ids
  JOIN public.profiles p ON p.id = ids.uid
  WHERE _user = auth.uid()
  ORDER BY COALESCE(p.points_total, 0) DESC;
$$;

REVOKE ALL ON FUNCTION public.friend_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard(uuid) TO authenticated;

-- Ciało jak w 20260623165423 + warunek. Klient tej funkcji dziś nie woła.
CREATE OR REPLACE FUNCTION public.friend_activity_feed(_user uuid, _limit int DEFAULT 20, _before timestamptz DEFAULT NULL)
RETURNS TABLE(
  kind text,
  review_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  place_id uuid,
  place_name text,
  place_slug text,
  rating int,
  body text,
  photo_url text,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH fr AS (SELECT friend_id FROM public.friends_of(_user))
  SELECT
    'review'::text,
    r.id,
    r.user_id,
    COALESCE(p.display_name, p.username, 'Ktos'),
    p.avatar_url,
    r.place_id,
    pl.name,
    pl.slug,
    r.rating::int,
    r.body,
    r.photo_url,
    r.created_at
  FROM public.reviews r
  JOIN fr ON fr.friend_id = r.user_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.places pl ON pl.id = r.place_id
  WHERE _user = auth.uid()
    AND (_before IS NULL OR r.created_at < _before)
    AND NOT public.is_blocked(_user, r.user_id)
  ORDER BY r.created_at DESC
  LIMIT GREATEST(_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.friend_activity_feed(uuid, integer, timestamptz) FROM PUBLIC, anon;
