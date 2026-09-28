-- Optymalizacja silnika odznak.
--
-- Do tej pory KAZDE zdarzenie (lajk, komentarz, zmiana punktow, edycja
-- recenzji...) wolalo check_achievements(), ktore oceniało wszystkie 71
-- kryteriow - takze te, na ktore zdarzenie nie ma wplywu, i takze odznaki juz
-- zdobyte. Przy dzisiejszej skali pomijalne, przy tysiacach recenzji nie.
--
-- Trzy zmiany:
--  1. check_achievements(user, typy) - opcjonalna lista kryteriow. Triggery
--     podaja tylko te, na ktore faktycznie wplywaja: lajk -> 2 kryteria
--     zamiast 71. NULL = pelne sprawdzenie - zostaje przy dodaniu recenzji
--     (realnie dotyka ~30 kryteriow i dziala jak siatka bezpieczenstwa), w
--     sciezkach admina i przy nadrabianiu zaleglosci.
--  2. Odznaki juz zdobyte sa pomijane - przyznania sa trwale, liczenie ich
--     bylo praca w proznie rosnaca z kazda zdobyta odznaka.
--  3. Dwa kryteria skanowaly cala baze zamiast uzytkownika (early_reviewer_rank
--     numerowal wszystkie recenzje, ranking_position sortowal wszystkie
--     profile) + trzy brakujace indeksy.
--
-- Legenda (all_achievements) jest oceniana na koncu zawsze, gdy w tym
-- wywolaniu cokolwiek przyznano - inaczej ukierunkowane sprawdzenie mogloby
-- przyznac ostatnia brakujaca odznake i przegapic legende.

-- ── Indeksy ────────────────────────────────────────────────────────────────
-- comments_count filtruje po autorze komentarza; byl tylko indeks po recenzji.
CREATE INDEX IF NOT EXISTS review_comments_user_idx ON public.review_comments (user_id);
-- first_review_new_place i early_reviewer_rank szukaja po lokalu i dacie.
CREATE INDEX IF NOT EXISTS reviews_place_created_idx ON public.reviews (place_id, created_at);
-- ranking_position liczy profile z wieksza liczba punktow.
CREATE INDEX IF NOT EXISTS profiles_points_created_idx ON public.profiles (points_total, created_at);

-- ── Pomiar: dwie galezie bez globalnych skanow ─────────────────────────────
CREATE OR REPLACE FUNCTION public.achievement_metric(_user_id uuid, _criteria jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_count int;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
  v_cuisine_pattern text;
  v_has_bool boolean;
  v_app_birthday date;
  v_value int := NULL;
  v_target int;
  v_meets boolean := false;
  v_lower_better boolean := false;
  v_measurable boolean := true;
  v_moje int;
  v_moj_czas timestamptz;
BEGIN
  v_type := _criteria->>'type';
  v_threshold := COALESCE(NULLIF(NULLIF(_criteria->>'threshold','true'),'false'), '1')::int;
  v_target := v_threshold;

  IF v_type = 'reviews_count' THEN
    SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
  ELSIF v_type = 'unique_places' THEN
    SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
  ELSIF v_type = 'points_total' THEN
    SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
  ELSIF v_type = 'friends_count' THEN
    v_count := public.get_friends_count(_user_id);
  ELSIF v_type = 'review_at_night' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
        OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
  ELSIF v_type = 'reviews_with_photo' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
  ELSIF v_type = 'review_streak_days' THEN
    WITH days AS (
      SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
      FROM public.reviews WHERE user_id = _user_id
    ),
    grp AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days),
    streaks AS (SELECT count(*)::int AS len FROM grp GROUP BY g)
    SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
  ELSIF v_type = 'one_star_reviews' THEN
    SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
    WHERE user_id = _user_id AND rating = 1;
  ELSIF v_type = 'distinct_cuisines' THEN
    SELECT count(DISTINCT pl.cuisine) INTO v_count
    FROM public.reviews rv JOIN public.places pl ON pl.id = rv.place_id
    WHERE rv.user_id = _user_id AND pl.cuisine IS NOT NULL AND pl.cuisine <> '';
  ELSIF v_type = 'all_achievements' THEN
    SELECT count(*) INTO v_total_other FROM public.achievements
      WHERE enabled = true AND slug <> 'pozaramy_legend';
    SELECT count(*) INTO v_user_other FROM public.user_achievements ua
      JOIN public.achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
    RETURN jsonb_build_object('value', v_user_other, 'target', v_total_other,
      'meets', v_total_other > 0 AND v_user_other >= v_total_other,
      'lower_better', false, 'measurable', true);
  ELSIF v_type = 'reviews_this_month' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw')
        = date_trunc('month', (now() AT TIME ZONE 'Europe/Warsaw'));
  ELSIF v_type = 'first_review_new_place' THEN
    SELECT count(*) INTO v_count FROM public.reviews r WHERE r.user_id = _user_id
      AND NOT EXISTS (SELECT 1 FROM public.reviews r2 WHERE r2.place_id = r.place_id AND r2.created_at < r.created_at);
  ELSIF v_type = 'unique_places_in_district' THEN
    SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
      SELECT count(DISTINCT r.place_id) AS cnt
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> ''
      GROUP BY pl.district) s;
  ELSIF v_type = 'unique_districts' THEN
    SELECT count(DISTINCT pl.district) INTO v_count
    FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
    WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> '';
  ELSIF v_type LIKE 'reviews_cuisine_%' THEN
    v_cuisine_pattern := CASE substring(v_type FROM 'reviews_cuisine_(.*)')
      WHEN 'japanese' THEN '(japo|sushi)'
      WHEN 'pizza'    THEN 'pizz'
      WHEN 'kebab'    THEN 'kebab'
      WHEN 'ramen'    THEN 'ramen'
      WHEN 'burger'   THEN 'burger'
      WHEN 'vege'     THEN '(wege|wegań|wegan|vege|vegan)'
      WHEN 'dessert'  THEN '(cukier|lody|lodz|deser|dessert)'
      WHEN 'coffee'   THEN '(kawa|kawiar|coffee|café|cafe)'
      ELSE NULL END;
    IF v_cuisine_pattern IS NULL THEN
      v_measurable := false;
    ELSE
      SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.cuisine ~* v_cuisine_pattern;
    END IF;
  ELSIF v_type = 'reviews_premium' THEN
    SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
    WHERE r.user_id = _user_id AND pl.price_range ~ '\$\$\$\$';
  ELSIF v_type = 'ranking_position' THEN
    SELECT COALESCE(points_total, 0), created_at INTO v_moje, v_moj_czas
    FROM public.profiles WHERE id = _user_id;
    IF v_moje IS NULL OR v_moje <= 0 THEN
      v_count := NULL;
    ELSE
      SELECT 1 + count(*) INTO v_count FROM public.profiles p
      WHERE COALESCE(p.points_total, 0) > 0
        AND (p.points_total > v_moje
             OR (p.points_total = v_moje AND p.created_at < v_moj_czas));
    END IF;
    RETURN jsonb_build_object('value', v_count, 'target', v_target,
      'meets', v_count IS NOT NULL AND v_count <= v_threshold,
      'lower_better', true, 'measurable', v_count IS NOT NULL);
  ELSIF v_type = 'review_likes_max' THEN
    SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
      SELECT count(*) AS cnt FROM public.review_reactions rr
      JOIN public.reviews r ON r.id = rr.review_id
      WHERE r.user_id = _user_id GROUP BY rr.review_id) s;
  ELSIF v_type = 'review_likes_total' THEN
    SELECT count(*) INTO v_count FROM public.review_reactions rr
    JOIN public.reviews r ON r.id = rr.review_id WHERE r.user_id = _user_id;
  ELSIF v_type = 'comments_count' THEN
    SELECT count(*) INTO v_count FROM public.review_comments rc
    JOIN public.reviews r ON r.id = rc.review_id
    WHERE rc.user_id = _user_id AND r.user_id <> _user_id;
  ELSIF v_type = 'referrals_count' THEN
    SELECT count(*) INTO v_count FROM public.friend_invites
    WHERE inviter_id = _user_id AND status = 'accepted';
  ELSIF v_type = 'review_length' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id AND length(coalesce(body,'')) >= v_threshold;
    v_target := 1;
  ELSIF v_type = 'long_reviews_count' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id AND length(coalesce(body,'')) >= 300;
  ELSIF v_type = 'review_before_9am' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 6 AND 8;
  ELSIF v_type = 'weekend_reviews' THEN
    SELECT count(DISTINCT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw')) INTO v_count
    FROM public.reviews WHERE user_id = _user_id
      AND EXTRACT(ISODOW FROM (created_at AT TIME ZONE 'Europe/Warsaw')) IN (6,7);
  ELSIF v_type = 'reviews_lunch_time' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 12 AND 14;
  ELSIF v_type = 'review_on_valentines' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 2
      AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 14;
  ELSIF v_type = 'review_on_nye' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id
      AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 12
      AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 31;
  ELSIF v_type = 'reviews_same_day' THEN
    SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
      SELECT count(*) AS cnt FROM public.reviews WHERE user_id = _user_id
      GROUP BY (created_at AT TIME ZONE 'Europe/Warsaw')::date) s;
  ELSIF v_type = 'early_reviewer_rank' THEN
    SELECT count(*) INTO v_count FROM (
      SELECT r.place_id,
        row_number() OVER (PARTITION BY r.place_id ORDER BY r.created_at ASC) AS rnk,
        count(*) OVER (PARTITION BY r.place_id) AS total,
        r.user_id
      FROM public.reviews r
      WHERE r.place_id IN (SELECT place_id FROM public.reviews WHERE user_id = _user_id)
    ) s
    WHERE s.total < 5 AND s.rnk <= v_threshold AND s.user_id = _user_id;
    v_target := 1;
  ELSIF v_type = 'profile_completed' THEN
    SELECT (avatar_url IS NOT NULL AND avatar_url <> '' AND bio IS NOT NULL AND length(trim(bio)) > 0)
      INTO v_has_bool FROM public.profiles WHERE id = _user_id;
    v_count := CASE WHEN COALESCE(v_has_bool, false) THEN 1 ELSE 0 END;
    v_target := 1;
  ELSIF v_type = 'beta_tester' THEN
    SELECT is_beta_tester INTO v_has_bool FROM public.profiles WHERE id = _user_id;
    v_count := CASE WHEN COALESCE(v_has_bool, false) THEN 1 ELSE 0 END;
    v_target := 1;
  ELSIF v_type = 'returned_after_break' THEN
    SELECT (returned_after_break_at IS NOT NULL) INTO v_has_bool
    FROM public.profiles WHERE id = _user_id;
    v_count := CASE WHEN COALESCE(v_has_bool, false) THEN 1 ELSE 0 END;
    v_target := 1;
  ELSIF v_type = 'active_on_app_birthday' THEN
    SELECT (value->>'date')::date INTO v_app_birthday
    FROM public.site_settings WHERE key = 'app_birthday';
    IF v_app_birthday IS NULL THEN
      v_measurable := false;
    ELSE
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(MONTH FROM v_app_birthday)
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(DAY FROM v_app_birthday);
      v_target := 1;
    END IF;
  ELSIF v_type = 'challenges_completed' THEN
    -- JEDYNA ZMIANA: zywa tabela zamiast martwej food_challenge_completions.
    SELECT count(*) INTO v_count FROM public.user_challenge_completions WHERE user_id = _user_id;
  ELSIF v_type = 'reviews_with_video' THEN
    SELECT count(*) INTO v_count FROM public.reviews
    WHERE user_id = _user_id AND video_url IS NOT NULL AND video_url <> '';
  ELSE
    v_measurable := false;
  END IF;

  IF NOT v_measurable THEN
    RETURN jsonb_build_object('value', NULL, 'target', v_target, 'meets', false,
                              'lower_better', false, 'measurable', false);
  END IF;

  v_value := COALESCE(v_count, 0);
  v_meets := v_value >= v_target;
  RETURN jsonb_build_object('value', v_value, 'target', v_target, 'meets', v_meets,
                            'lower_better', v_lower_better, 'measurable', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.achievement_metric(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Silnik z lista kryteriow ───────────────────────────────────────────────
-- Stara wersja (uuid) musi zniknac: przy dwoch przeciazeniach wywolanie z
-- jednym argumentem byloby niejednoznaczne. Nowa ma domyslne NULL, wiec
-- wszystkie istniejace wywolania check_achievements(uid) dzialaja bez zmian.
DROP FUNCTION IF EXISTS public.check_achievements(uuid);

CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid, _typy text[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
  v_przyznano boolean := false;
BEGIN
  FOR ach IN
    SELECT a.id, a.criteria FROM public.achievements a
    WHERE a.enabled = true
      AND (a.criteria->>'type') IS DISTINCT FROM 'all_achievements'
      AND (_typy IS NULL OR (a.criteria->>'type') = ANY (_typy))
      AND NOT EXISTS (
        SELECT 1 FROM public.user_achievements ua
        WHERE ua.user_id = _user_id AND ua.achievement_id = a.id
      )
    ORDER BY a.sort_order
  LOOP
    IF (public.achievement_metric(_user_id, ach.criteria)->>'meets')::boolean THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id) ON CONFLICT DO NOTHING;
      IF FOUND THEN v_przyznano := true; END IF;
    END IF;
  END LOOP;

  -- Legenda na koncu: liczy odznaki, wiec musi widziec te przyznane wyzej.
  IF v_przyznano OR _typy IS NULL OR 'all_achievements' = ANY (_typy) THEN
    FOR ach IN
      SELECT a.id, a.criteria FROM public.achievements a
      WHERE a.enabled = true
        AND (a.criteria->>'type') = 'all_achievements'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_achievements ua
          WHERE ua.user_id = _user_id AND ua.achievement_id = a.id
        )
    LOOP
      IF (public.achievement_metric(_user_id, ach.criteria)->>'meets')::boolean THEN
        INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (_user_id, ach.id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_achievements(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- ── Triggery: kazdy podaje tylko swoje kryteria ────────────────────────────
CREATE OR REPLACE FUNCTION public.review_reactions_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_autor uuid;
BEGIN
  SELECT user_id INTO v_autor FROM public.reviews WHERE id = NEW.review_id;
  IF v_autor IS NOT NULL THEN
    PERFORM public.check_achievements(v_autor, ARRAY['review_likes_total', 'review_likes_max']);
  END IF;
  RETURN NEW;
END;
$$;

-- Wspolny dla komentarzy i ukonczonych wyzwan - kryterium po nazwie tabeli.
CREATE OR REPLACE FUNCTION public.row_owner_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(
    NEW.user_id,
    CASE TG_TABLE_NAME
      WHEN 'review_comments' THEN ARRAY['comments_count']
      WHEN 'user_challenge_completions' THEN ARRAY['challenges_completed']
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_typy text[] := ARRAY[]::text[];
BEGIN
  IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url OR OLD.bio IS DISTINCT FROM NEW.bio THEN
    v_typy := v_typy || 'profile_completed';
  END IF;
  IF OLD.points_total IS DISTINCT FROM NEW.points_total THEN
    v_typy := v_typy || ARRAY['points_total', 'ranking_position'];
  END IF;
  IF array_length(v_typy, 1) > 0 THEN
    PERFORM public.check_achievements(NEW.id, v_typy);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_check_achievements_on_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(
    NEW.user_id,
    ARRAY['reviews_with_photo', 'reviews_with_video', 'review_length', 'long_reviews_count']
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.friendships_check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.check_achievements(NEW.requester_id, ARRAY['friends_count']);
    PERFORM public.check_achievements(NEW.addressee_id, ARRAY['friends_count']);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.friend_invites_check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.check_achievements(NEW.inviter_id, ARRAY['referrals_count']);
  END IF;
  RETURN NEW;
END;
$$;

-- Reczne odblokowanie: tresc bez zmian (20260927160000), sprawdzana juz tylko
-- legenda - odznaka reczna moze byc ostatnia brakujaca.
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

  PERFORM public.check_achievements(auth.uid(), ARRAY['all_achievements']);
  RETURN true;
END;
$$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Optymalizacja silnika odznak: triggery sprawdzaja tylko swoje kryteria (lajk 2 zamiast 71), zdobyte odznaki pomijane, bez globalnych skanow w rankingu i wczesnym recenzencie, 3 nowe indeksy.');
