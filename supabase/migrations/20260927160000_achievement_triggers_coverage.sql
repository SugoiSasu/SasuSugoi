-- Pokrycie silnika odznak triggerami - domkniecie audytu.
--
-- Silnik jest reaktywny: check_achievements() odpala sie tylko tam, gdzie ktos
-- podpial trigger. Po naprawie `profile_completed` (migracja 20260927140000)
-- przejrzalem wszystkie 44 kryteria i zestawilem je z tabelami, ktorych zmiana
-- faktycznie wola silnik. Byly to tylko cztery: reviews (INSERT), friendships,
-- friend_invites i profiles. Szesc luk:
--
--  1. review_likes_total / review_likes_max  -> review_reactions: brak triggera.
--     Uwaga: lajk daje KTOS INNY na TWOJEJ recenzji, wiec silnik trzeba odpalic
--     dla AUTORA recenzji, a nie dla lajkujacego.
--  2. comments_count -> review_comments: brak triggera.
--  3. challenges_completed -> food_challenge_completions: brak triggera.
--  4. points_total, ranking_position -> profiles.points_total: punkty za wpisy,
--     listy, zaproszenia i wyzwania nie odpalaly silnika (award_points go nie
--     wola). Odznaki za punkty wpadaly dopiero przy nastepnej recenzji.
--  5. reviews_with_photo, reviews_with_video, review_length,
--     long_reviews_count -> reviews: trigger byl tylko na INSERT, wiec dodanie
--     zdjecia albo wydluzenie tekstu przez EDYCJE recenzji nie liczylo sie.
--  6. all_achievements -> user_achievements: reczne odblokowanie
--     (unlock_manual_achievement) nie odpalalo silnika, a w samej petli
--     check_achievements "legenda" mogla byc oceniana przed odznakami
--     przyznanymi w tym samym przebiegu.
--
-- Wszystkie nowe triggery sa AFTER i wolaja check_achievements, ktore samo nie
-- modyfikuje ZADNEJ z tych tabel (wstawia tylko do user_achievements), wiec
-- nie ma sciezki do rekurencji - patrz komentarze przy kazdym.

-- ── 1. Reakcje na recenzje: dla AUTORA recenzji ───────────────────────────
CREATE OR REPLACE FUNCTION public.review_reactions_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_autor uuid;
BEGIN
  SELECT user_id INTO v_autor FROM public.reviews WHERE id = NEW.review_id;
  IF v_autor IS NOT NULL THEN
    PERFORM public.check_achievements(v_autor);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_reactions_check_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS review_reactions_check_achievements_after_insert ON public.review_reactions;
CREATE TRIGGER review_reactions_check_achievements_after_insert
  AFTER INSERT ON public.review_reactions
  FOR EACH ROW EXECUTE FUNCTION public.review_reactions_check_achievements();

-- ── 2 i 3. Komentarze i ukonczone wyzwania: dla autora wiersza ─────────────
CREATE OR REPLACE FUNCTION public.row_owner_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.row_owner_check_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS review_comments_check_achievements_after_insert ON public.review_comments;
CREATE TRIGGER review_comments_check_achievements_after_insert
  AFTER INSERT ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.row_owner_check_achievements();

DROP TRIGGER IF EXISTS food_challenge_completions_check_achievements_after_insert ON public.food_challenge_completions;
CREATE TRIGGER food_challenge_completions_check_achievements_after_insert
  AFTER INSERT ON public.food_challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.row_owner_check_achievements();

-- ── 4. Punkty: rozszerzenie triggera na profiles o points_total ───────────
-- Bezpieczne dla rekurencji: jedyny trigger zapisujacy do profiles w lancuchu
-- przyznawania odznak to user_achievements_grant_vip, ktory rusza is_vip i
-- vip_until - nie ma ich na liscie OF, wiec ten trigger sie nie odpali.
-- check_achievements samo nie zmienia points_total (odznaki nie daja punktow).
DROP TRIGGER IF EXISTS profiles_check_achievements_after_update ON public.profiles;
CREATE TRIGGER profiles_check_achievements_after_update
  AFTER UPDATE OF avatar_url, bio, points_total ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
    OR OLD.bio IS DISTINCT FROM NEW.bio
    OR OLD.points_total IS DISTINCT FROM NEW.points_total
  )
  EXECUTE FUNCTION public.profiles_check_achievements();

-- ── 5. Edycja recenzji ────────────────────────────────────────────────────
-- Tylko kolumny, od ktorych zaleza kryteria, i tylko przy faktycznej zmianie.
-- check_achievements nie zapisuje do reviews, wiec rekurencji brak.
CREATE OR REPLACE FUNCTION public.reviews_check_achievements_on_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reviews_check_achievements_on_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_check_achievements_after_update ON public.reviews;
CREATE TRIGGER reviews_check_achievements_after_update
  AFTER UPDATE OF body, photo_url, video_url ON public.reviews
  FOR EACH ROW
  WHEN (
    OLD.body IS DISTINCT FROM NEW.body
    OR OLD.photo_url IS DISTINCT FROM NEW.photo_url
    OR OLD.video_url IS DISTINCT FROM NEW.video_url
  )
  EXECUTE FUNCTION public.reviews_check_achievements_on_update();

-- ── 6a. Legenda oceniana na koncu przebiegu ────────────────────────────────
-- Jedyna zmiana wzgledem 20260927130000: ORDER BY w petli. Kryterium
-- all_achievements liczy odznaki uzytkownika, wiec musi byc sprawdzane PO
-- wszystkich innych - inaczej odznaki przyznane w tym samym przebiegu nie
-- sa jeszcze policzone i legenda czeka do nastepnego wywolania.
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
BEGIN
  FOR ach IN
    SELECT id, criteria FROM public.achievements
    WHERE enabled = true
    ORDER BY (criteria->>'type' = 'all_achievements'), sort_order
  LOOP
    IF (public.achievement_metric(_user_id, ach.criteria)->>'meets')::boolean THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- ── 6b. Reczne odblokowanie odpala silnik ──────────────────────────────────
-- Tresc bez zmian wzgledem rundy 2 (20260925120000), dopisane tylko PERFORM
-- po wstawieniu - odznaka reczna moze byc ostatnia brakujaca do legendy.
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

  PERFORM public.check_achievements(auth.uid());
  RETURN true;
END;
$$;

-- ── Nadrobienie zaleglosci ─────────────────────────────────────────────────
-- Pomija 6 osieroconych profili z migracji z Lovable (brak wiersza w
-- auth.users -> klucz obcy w user_achievements przerwalby cala petle).
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN
    SELECT p.id FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id)
  LOOP
    PERFORM public.check_achievements(u);
  END LOOP;
END $$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Silnik odznak: triggery na reakcjach i komentarzach recenzji, wyzwaniach, punktach i edycji recenzji; legenda oceniana na koncu; reczne odblokowanie odpala silnik.');
