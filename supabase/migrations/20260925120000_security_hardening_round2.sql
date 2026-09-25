-- Druga tura poprawek z audytu RLS/SECURITY DEFINER (pierwsza:
-- 20260916130000). Osiem poprawek, ktore nie wymagaly decyzji produktowej.
-- Znaleziska oznaczone [live] zostaly odtworzone na produkcji na jednorazowych
-- kontach audit_ (usunietych po tescie); reszta to jednoznaczny stan polityk.

-- ── 1. [live] Samodzielne "przyjecie" wlasnych zaproszen = 150 pkt + VIP ──
-- Polityka UPDATE sprawdzala tylko inviter_id, wiec wystarczylo wstawic 10
-- zaproszen i jednym PATCH-em ustawic im status 'accepted'. Test na czystym
-- koncie: points_total 0 -> 150, is_vip false -> true (do 2027), 6 odznak.
-- Jedyna legalna droga do 'accepted' to accept_friend_invite() - funkcja
-- SECURITY DEFINER, ktorej RLS nie dotyczy, wiec zawezenie jej nie blokuje.
-- Klient (src/lib/friends-api.ts) wstawia bez statusu i zmienia go wylacznie
-- na 'revoked', wiec nic sie nie psuje.
DROP POLICY IF EXISTS "fi_owner_insert" ON public.friend_invites;
CREATE POLICY "fi_owner_insert" ON public.friend_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND status = 'pending'
    AND accepted_by IS NULL
    AND accepted_at IS NULL
  );

DROP POLICY IF EXISTS "fi_owner_update" ON public.friend_invites;
CREATE POLICY "fi_owner_update" ON public.friend_invites
  FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() AND status = 'pending')
  WITH CHECK (inviter_id = auth.uid() AND status = 'revoked' AND accepted_by IS NULL);

-- ── 2. Samodzielne nadanie sobie zlotej odznaki 'beta_tester' ────────────
-- unlock_manual_achievement() przyjmowalo dowolny slug typu 'manual'. W bazie
-- sa dokladnie dwie takie odznaki: 'found_yourself' (easter egg z mapy, ma byc
-- odblokowywany przez klienta) i 'beta_tester' (zlota, do nadania przez
-- admina). Zamiast listy slugow w kodzie - jawna kolumna.
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS self_unlockable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.achievements.self_unlockable IS
  'Czy klient moze sam odblokowac te odznake przez unlock_manual_achievement(). Tylko easter eggi.';

UPDATE public.achievements SET self_unlockable = true WHERE slug = 'found_yourself';

CREATE OR REPLACE FUNCTION public.unlock_manual_achievement(_slug text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_achievement_id uuid;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_achievement_id
  FROM public.achievements
  WHERE slug = _slug
    AND enabled = true
    AND (criteria->>'type') = 'manual'
    AND self_unlockable = true;
  IF v_achievement_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_achievements
    WHERE user_id = auth.uid() AND achievement_id = v_achievement_id
  ) INTO v_already;
  IF v_already THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (auth.uid(), v_achievement_id);
  RETURN true;
END;
$$;

-- ── 3. "Odpowiedz wlasciciela" pod recenzja konkurencji ──────────────────
-- WITH CHECK wiazal owner_id z place_id, ale nikt nie sprawdzal, czy recenzja
-- spod ktorej odpowiadamy w ogole dotyczy tego lokalu. Wlasciciel lokalu A
-- podstawial review_id z lokalu B i jego odpowiedz renderowala sie u
-- konkurencji - a prawdziwy wlasciciel nie mogl jej skasowac, bo DELETE
-- patrzylo tylko na owner_id.
DROP POLICY IF EXISTS "review_replies owner insert" ON public.review_replies;
CREATE POLICY "review_replies owner insert" ON public.review_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND public.is_place_owner(auth.uid(), place_id)
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_replies.review_id AND r.place_id = review_replies.place_id
    )
  );

DROP POLICY IF EXISTS "review_replies owner delete" ON public.review_replies;
CREATE POLICY "review_replies owner delete" ON public.review_replies
  FOR DELETE TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_place_owner(auth.uid(), place_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ── 4. Sfalszowany, juz "zatwierdzony" wniosek o wlascicielstwo ──────────
-- INSERT nie ogranicza status ani pol moderacji, wiec dalo sie wstawic wniosek
-- od razu jako 'approved' i podlozyc historie moderacji. Samo w sobie nie daje
-- uprawnien (te nadaje admin, wpisujac do place_owners), ale brudzi kolejke
-- moderacji i moze zmylic osobe, ktora ja przeglada.
DROP POLICY IF EXISTS "owner_requests insert authenticated" ON public.owner_requests;
CREATE POLICY "owner_requests insert authenticated" ON public.owner_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id OR user_id IS NULL)
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

-- ── 5. Klient ustawial reviews.created_at ────────────────────────────────
-- Data recenzji sluzy do sortowania na stronie lokalu ORAZ do okien czasowych
-- wyzwan (check_challenges) i odznak zaleznych od pory dnia. Skoro przychodzila
-- z klienta, mozna bylo przypiac recenzje na gorze i zaliczyc wyzwanie wstecz.
CREATE OR REPLACE FUNCTION public.reviews_pin_created_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Tylko zadania od zalogowanego uzytkownika. Import przez service_role
  -- (auth.uid() IS NULL) musi moc zachowac oryginalne daty.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSIF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.reviews_pin_created_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_pin_created_at ON public.reviews;
CREATE TRIGGER reviews_pin_created_at
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_pin_created_at();

-- ── 6. Sciana (Pozeralnia) byla czytelna dla kazdego, takze bez konta ────
-- Ustawienia obiecuja: "Tylko Twoi znajomi widza wall i listy miejsc", a
-- wall_posts/wall_comments/wall_reactions mialy SELECT USING (true) z GRANT-em
-- dla anon. Filtr po znajomych siedzial wylacznie w kliencie
-- (wall-api.ts: .in('user_id', feedUserIds)). Ta sama regula co place_visits.
--
-- UWAGA: place_lists i place_list_items celowo NIE sa tu zawezane - listy
-- otwiera sie publicznym linkiem /l/<id> i nie maja kolumny is_public, wiec
-- zamkniecie ich zepsuloby dzielenie sie listami. To sprzecznosc miedzy
-- funkcja a obietnica w Ustawieniach i wymaga decyzji produktowej.
DROP POLICY IF EXISTS "wall_posts public read" ON public.wall_posts;
CREATE POLICY "wall_posts read own public or friend" ON public.wall_posts
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = wall_posts.user_id AND p.is_public = true)
  );

DROP POLICY IF EXISTS "wall_comments public read" ON public.wall_comments;
CREATE POLICY "wall_comments read own public or friend" ON public.wall_comments
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = wall_comments.user_id AND p.is_public = true)
  );

DROP POLICY IF EXISTS "wall_reactions public read" ON public.wall_reactions;
CREATE POLICY "wall_reactions read own public or friend" ON public.wall_reactions
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = wall_reactions.user_id AND p.is_public = true)
  );

-- ── 7. review_reactions.type bez ograniczenia ───────────────────────────
-- Klucz glowny to (review_id, user_id, type), wiec dowolny nowy 'type' tworzyl
-- kolejny wiersz: jedno konto moglo dolozyc nieskonczenie wiele reakcji do
-- jednej recenzji (licznik, tytul "Zaufany Glos", lawina powiadomien).
-- Klient wysyla wylacznie 'like'.
DELETE FROM public.review_reactions WHERE type <> 'like';

ALTER TABLE public.review_reactions
  DROP CONSTRAINT IF EXISTS review_reactions_type_allowed;
ALTER TABLE public.review_reactions
  ADD CONSTRAINT review_reactions_type_allowed CHECK (type = 'like');

-- ── 8. Reklamy: anonim widzial takze wylaczone i zaplanowane ────────────
-- Filtr "na zywo" byl w JS (ads-api.ts isLive). Tresc przyszlych kampanii i
-- stawek nie powinna wyciekac przed startem; admin nadal widzi wszystko.
DROP POLICY IF EXISTS "ads read all" ON public.ads;
CREATE POLICY "ads read live or admin" ON public.ads
  FOR SELECT TO anon, authenticated
  USING (
    (
      active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );
