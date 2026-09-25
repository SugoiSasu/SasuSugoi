-- Trzecia tura z audytu RLS/SECURITY DEFINER (poprzednie: 20260916130000,
-- 20260925120000). Audyt domknal sie na 24 potwierdzonych znaleziskach;
-- domena "funkcje SECURITY DEFINER" dorzucila dwa ostatnie (1 i 2 ponizej).
-- [live] = odtworzone na produkcji na jednorazowym koncie audit_ (usunietym).

-- ── 1. [live] check_challenges() bez zadnego GRANT/REVOKE ───────────────
-- Zadna migracja nigdy nie ruszyla uprawnien tej funkcji, wiec obowiazywalo
-- domyslne EXECUTE dla PUBLIC. Test: klucz anon, BEZ konta, wywolal
-- check_challenges(<obce uuid>) i zapytanie przeszlo. Funkcja jest SECURITY
-- DEFINER i zapisuje do user_challenge_completions, przyznaje punkty i tworzy
-- wpisy - w imieniu podanego uzytkownika, kogokolwiek by nie wskazac.
-- Klient nigdy jej nie wola (tylko triggery po stronie bazy), wiec zamykamy
-- ja calkowicie, tak jak inne funkcje wewnetrzne (award_points, notify).
REVOKE EXECUTE ON FUNCTION public.check_challenges(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. [live] get_friends_count() - przeoczenie przy latce z round1 ─────
-- friends_of() dostalo wtedy warunek "wlasciciel / znajomy / profil publiczny",
-- a blizniacza funkcja nie. Test: anon bez konta odczytal licznik dla konta
-- prywatnego. Anon zachowuje dostep do licznikow profili publicznych (/u/...).
CREATE OR REPLACE FUNCTION public.get_friends_count(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
    AND (
      _user_id = auth.uid()
      OR public.is_friend_with(_user_id)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.is_public = true)
    );
$$;

-- ── 3. Obejscie blokady przez przepiecie komentarza/reakcji ─────────────
-- Polityki INSERT sprawdzaja user_blocks, ale polityki UPDATE pilnuja tylko
-- user_id = auth.uid(). Zablokowany pisal komentarz pod wlasna recenzja, a
-- potem PATCH-em przestawial review_id na recenzje ofiary - kontrola blokady
-- nie byla powtarzana, a ofiara nie mogla tego usunac. Ten sam wzorzec co
-- friendships_guard_parties: WITH CHECK nie widzi starego wiersza.
-- Klient edytuje wylacznie body, wiec nic sie nie psuje.
CREATE OR REPLACE FUNCTION public.comments_guard_target()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'review_comments' THEN
    IF NEW.review_id IS DISTINCT FROM OLD.review_id THEN
      RAISE EXCEPTION 'comment target is immutable' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.ref_id IS DISTINCT FROM OLD.ref_id THEN
      RAISE EXCEPTION 'comment/reaction target is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.comments_guard_target() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS review_comments_guard_target ON public.review_comments;
CREATE TRIGGER review_comments_guard_target BEFORE UPDATE ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_guard_target();

DROP TRIGGER IF EXISTS wall_comments_guard_target ON public.wall_comments;
CREATE TRIGGER wall_comments_guard_target BEFORE UPDATE ON public.wall_comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_guard_target();

DROP TRIGGER IF EXISTS wall_reactions_guard_target ON public.wall_reactions;
CREATE TRIGGER wall_reactions_guard_target BEFORE UPDATE ON public.wall_reactions
  FOR EACH ROW EXECUTE FUNCTION public.comments_guard_target();

-- ── 4. Szkice lokali ukryte tylko w tabeli places ───────────────────────
-- places ma USING (is_published = true), ale tabele podrzedne mialy USING
-- (true) z GRANT-em dla anon, wiec adres, wspolrzedne i zdjecia szkicu byly
-- publiczne. Galezie has_role/is_place_owner sa konieczne, zeby panel admina
-- i wlasciciel dalej widzieli wlasny nieopublikowany lokal.
DROP POLICY IF EXISTS "place_locations public read" ON public.place_locations;
CREATE POLICY "place_locations read published" ON public.place_locations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_locations.place_id AND p.is_published = true)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_locations.place_id)
  );

DROP POLICY IF EXISTS "place_posts read all" ON public.place_posts;
CREATE POLICY "place_posts read published" ON public.place_posts
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_posts.place_id AND p.is_published = true)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_posts.place_id)
  );

DROP POLICY IF EXISTS "Anyone can view place photos" ON public.place_photos;
CREATE POLICY "place_photos read published" ON public.place_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_photos.place_id AND p.is_published = true)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_photos.place_id)
  );

-- ── 5. Storage: wlasciciel JEDNEGO lokalu mogl kasowac zdjecia WSZYSTKICH ─
-- Trzy polityki na storage.objects sprawdzaly wylacznie is_verified_owner(uid),
-- czyli "czy jestes wlascicielem czegokolwiek", bez patrzenia na folder. Skoro
-- sciezki sa jawne w publicznym cover_image_url, a podpisane URL-e wskazuja
-- sciezke a nie wersje pliku, podmiana byla natychmiast widoczna na stronie
-- konkurencji. Tabela place_photos byla zawezona poprawnie - Storage nie.
--
-- Klient zapisuje pod ${placeId}/... (src/lib/place-image-upload.ts:30,
-- src/lib/place-photos-api.ts:56), wiec nowy warunek go nie dotyka. Starsze
-- sciezki 'covers/...' i 'avatars/...' z panelu admina maja w pierwszym
-- segmencie nie-UUID, wiec pozostana dostepne tylko dla admina - zgodnie z
-- tym, ze powstaja wylacznie na trasie admina.
CREATE OR REPLACE FUNCTION public.owns_place_photo_path(_uid uuid, _name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.place_owners po
    WHERE po.user_id = _uid
      AND po.verified = true
      AND po.place_id::text = (storage.foldername(_name))[1]
  );
$$;

REVOKE ALL ON FUNCTION public.owns_place_photo_path(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_place_photo_path(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Admins and owners can upload place-photos" ON storage.objects;
CREATE POLICY "Admins and owners can upload place-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.owns_place_photo_path(auth.uid(), name)
    )
  );

DROP POLICY IF EXISTS "Admins and owners can update place-photos" ON storage.objects;
CREATE POLICY "Admins and owners can update place-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.owns_place_photo_path(auth.uid(), name)
    )
  );

DROP POLICY IF EXISTS "Admins and owners can delete place-photos" ON storage.objects;
CREATE POLICY "Admins and owners can delete place-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.owns_place_photo_path(auth.uid(), name)
    )
  );

-- ── 6. collab_submissions: bezposredni INSERT omijal serwerowa funkcje ──
-- GRANT INSERT dla anon obejmuje wszystkie kolumny, a polityka sprawdzala
-- tylko zgode i format maila. Dalo sie wstawic wiersz od razu ze statusem
-- innym niz 'new', z admin_notes i z wstecznym consent_accepted_at - czyli
-- sfalszowac dowod zgody RODO, ktory panel admina pokazuje jako wiarygodny.
DROP POLICY IF EXISTS "Anyone can submit collab with consent" ON public.collab_submissions;
CREATE POLICY "Anyone can submit collab with consent" ON public.collab_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    consent_version IS NOT NULL
    AND length(consent_version) > 0
    AND consent_accepted_at IS NOT NULL
    AND consent_accepted_at BETWEEN now() - interval '10 minutes' AND now() + interval '1 minute'
    AND created_at BETWEEN now() - interval '10 minutes' AND now() + interval '1 minute'
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND status = 'new'
    AND admin_notes IS NULL
    AND status_updated_at IS NULL
    AND status_updated_by IS NULL
  );
