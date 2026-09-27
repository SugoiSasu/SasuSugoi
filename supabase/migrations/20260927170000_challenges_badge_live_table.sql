-- Odznaki za wyzwania byly nieosiagalne dla KAZDEGO.
--
-- W bazie sa dwa systemy wyzwan:
--   food_challenges + food_challenge_completions  - stary, martwy: 0 wyzwan,
--       0 ukonczen, nieuzywany przez interfejs (odwoluje sie do niego tylko
--       dawny harness run_achievement_tests).
--   challenges + user_challenge_completions       - zywy: 3 wyzwania widoczne
--       na ekranie ("Tydzien kebabu", "Piec nowych knajp", "Trasa kuchni
--       swiata"); check_challenges() zapisuje ukonczenia wlasnie tutaj
--       (migracja 20260821170000), a ChallengesSection stad czyta.
--
-- Kryterium odznak `challenges_completed` (challenge_accepted:1,
-- challenge_maniac:10) liczylo STARA tabele. Ukonczenie prawdziwego wyzwania
-- nigdy nie przyblizalo do tych odznak.
--
-- Poprzednia migracja (20260927160000) dopiela trigger do tej samej martwej
-- tabeli - bezuzyteczny, wiec zdejmowany ponizej.

-- ── achievement_metric: challenges_completed z zywej tabeli ────────────────
-- Cialo bez zmian wzgledem 20260927130000 poza jedna galezia. Odtwarzane w
-- calosci, bo Postgres nie pozwala podmienic fragmentu funkcji.
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
    SELECT rnk INTO v_count FROM (
      SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
      FROM public.profiles WHERE COALESCE(points_total,0) > 0
    ) s WHERE id = _user_id;
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

-- ── Trigger na ZYWEJ tabeli, zdjecie bezuzytecznego z martwej ──────────────
DROP TRIGGER IF EXISTS food_challenge_completions_check_achievements_after_insert
  ON public.food_challenge_completions;

DROP TRIGGER IF EXISTS user_challenge_completions_check_achievements_after_insert
  ON public.user_challenge_completions;
CREATE TRIGGER user_challenge_completions_check_achievements_after_insert
  AFTER INSERT ON public.user_challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.row_owner_check_achievements();

-- ── debug_achievement_metrics: ostatnia kopia pomiaru, teraz delegatem ─────
-- Liczyla sama tylko 6 typow (w tym challenges_completed z martwej tabeli),
-- a dla reszty zwracala napis "(computed in check_achievements)". Teraz
-- kazdy z 44 typow ma prawdziwa wartosc, liczona tym samym kodem co przyznanie.
-- Sygnatura i sprawdzenie roli admina bez zmian.
CREATE OR REPLACE FUNCTION public.debug_achievement_metrics(_user_id uuid)
RETURNS TABLE(slug text, type text, threshold text, meets boolean, current_value text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  ach record;
  m jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR ach IN SELECT a.slug, a.criteria FROM public.achievements a WHERE a.enabled = true ORDER BY a.sort_order LOOP
    m := public.achievement_metric(_user_id, ach.criteria);
    -- RETURN QUERY zamiast przypisan do parametrow wyjsciowych: nazwy `slug`
    -- i `type` kolidowalyby w plpgsql z kolumnami i slowem kluczowym - ten sam
    -- wzorzec co w oryginale.
    RETURN QUERY SELECT
      ach.slug::text,
      (ach.criteria->>'type')::text,
      (ach.criteria->>'threshold')::text,
      (m->>'meets')::boolean,
      CASE WHEN (m->>'measurable')::boolean
           THEN (m->>'value') || ' / ' || (m->>'target')
           ELSE '(nie da sie zmierzyc)' END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.debug_achievement_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_achievement_metrics(uuid) TO authenticated;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Odznaki za wyzwania licza zywa tabele user_challenge_completions zamiast martwej food_challenge_completions; debug_achievement_metrics deleguje do achievement_metric.');
