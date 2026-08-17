-- =====================================================
-- 1) Data sources
-- =====================================================

-- Beta tester flag + "returned after break" timestamp on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_after_break_at timestamptz;

-- Video URL on reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS video_url text;

-- App birthday setting (defaults to project inception date; admin can update via site_settings)
INSERT INTO public.site_settings (key, value)
VALUES ('app_birthday', jsonb_build_object('date', '2025-01-15'))
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2) Food challenges tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.food_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.food_challenges TO authenticated, anon;
GRANT ALL ON public.food_challenges TO service_role;

ALTER TABLE public.food_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges public read" ON public.food_challenges;
CREATE POLICY "challenges public read" ON public.food_challenges
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "challenges admin write" ON public.food_challenges;
CREATE POLICY "challenges admin write" ON public.food_challenges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.food_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.food_challenges(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

GRANT SELECT, INSERT, DELETE ON public.food_challenge_completions TO authenticated;
GRANT ALL ON public.food_challenge_completions TO service_role;

ALTER TABLE public.food_challenge_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completions own read" ON public.food_challenge_completions;
CREATE POLICY "completions own read" ON public.food_challenge_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "completions admin read" ON public.food_challenge_completions;
CREATE POLICY "completions admin read" ON public.food_challenge_completions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "completions admin write" ON public.food_challenge_completions;
CREATE POLICY "completions admin write" ON public.food_challenge_completions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- =====================================================
-- 3) Triggers: returned_after_break + achievement re-check
-- =====================================================
CREATE OR REPLACE FUNCTION public.reviews_track_returned_after_break()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_prev timestamptz;
BEGIN
  SELECT max(created_at) INTO v_prev
  FROM public.reviews
  WHERE user_id = NEW.user_id AND id <> NEW.id AND created_at < NEW.created_at;

  IF v_prev IS NOT NULL AND (NEW.created_at - v_prev) > INTERVAL '30 days' THEN
    UPDATE public.profiles
    SET returned_after_break_at = NEW.created_at
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reviews_returned_after_break ON public.reviews;
CREATE TRIGGER trg_reviews_returned_after_break
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_track_returned_after_break();

CREATE OR REPLACE FUNCTION public.food_challenge_completion_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_challenge_completion_award ON public.food_challenge_completions;
CREATE TRIGGER trg_challenge_completion_award
  AFTER INSERT ON public.food_challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.food_challenge_completion_award();

-- =====================================================
-- 4) Extend check_achievements with real data sources
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
  v_cuisine_pattern text;
  v_has_bool boolean;
  v_app_birthday date;
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    v_threshold := COALESCE(NULLIF(NULLIF(ach.criteria->>'threshold','true'),'false'), '1')::int;
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_at_night' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_with_photo' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_streak_days' THEN
      WITH days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM public.reviews WHERE user_id = _user_id
      ),
      grp AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days),
      streaks AS (SELECT count(*)::int AS len FROM grp GROUP BY g)
      SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'one_star_reviews' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND rating = 1;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'distinct_cuisines' THEN
      SELECT count(DISTINCT pl.cuisine) INTO v_count
      FROM public.reviews rv JOIN public.places pl ON pl.id = rv.place_id
      WHERE rv.user_id = _user_id AND pl.cuisine IS NOT NULL AND pl.cuisine <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'all_achievements' THEN
      SELECT count(*) INTO v_total_other FROM public.achievements
        WHERE enabled = true AND slug <> 'pozaramy_legend';
      SELECT count(*) INTO v_user_other FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
      v_meets := v_total_other > 0 AND v_user_other >= v_total_other;
    ELSIF v_type = 'reviews_this_month' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw')
          = date_trunc('month', (now() AT TIME ZONE 'Europe/Warsaw'));
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'first_review_new_place' THEN
      SELECT count(*) INTO v_count FROM public.reviews r WHERE r.user_id = _user_id
        AND NOT EXISTS (SELECT 1 FROM public.reviews r2 WHERE r2.place_id = r.place_id AND r2.created_at < r.created_at);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places_in_district' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(DISTINCT r.place_id) AS cnt
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> ''
        GROUP BY pl.district) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_districts' THEN
      SELECT count(DISTINCT pl.district) INTO v_count
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> '';
      v_meets := v_count >= v_threshold;
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
      IF v_cuisine_pattern IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.cuisine ~* v_cuisine_pattern;
        v_meets := v_count >= v_threshold;
      END IF;
    ELSIF v_type = 'reviews_premium' THEN
      SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.price_range ~ '\$\$\$\$';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'ranking_position' THEN
      SELECT rnk INTO v_count FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0
      ) s WHERE id = _user_id;
      IF v_count IS NOT NULL THEN v_meets := v_count <= v_threshold; END IF;
    ELSIF v_type = 'review_likes_max' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.review_reactions rr
        JOIN public.reviews r ON r.id = rr.review_id
        WHERE r.user_id = _user_id GROUP BY rr.review_id) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_likes_total' THEN
      SELECT count(*) INTO v_count FROM public.review_reactions rr
      JOIN public.reviews r ON r.id = rr.review_id WHERE r.user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'comments_count' THEN
      SELECT count(*) INTO v_count FROM public.review_comments rc
      JOIN public.reviews r ON r.id = rc.review_id
      WHERE rc.user_id = _user_id AND r.user_id <> _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'referrals_count' THEN
      SELECT count(*) INTO v_count FROM public.friend_invites
      WHERE inviter_id = _user_id AND status = 'accepted';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_length' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= v_threshold;
      v_meets := v_count >= 1;
    ELSIF v_type = 'long_reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= 300;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_before_9am' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 6 AND 8;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'weekend_reviews' THEN
      SELECT count(DISTINCT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw')) INTO v_count
      FROM public.reviews WHERE user_id = _user_id
        AND EXTRACT(ISODOW FROM (created_at AT TIME ZONE 'Europe/Warsaw')) IN (6,7);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_lunch_time' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 12 AND 14;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_on_valentines' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 2
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 14;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_on_nye' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 12
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 31;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_same_day' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.reviews WHERE user_id = _user_id
        GROUP BY (created_at AT TIME ZONE 'Europe/Warsaw')::date) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'early_reviewer_rank' THEN
      SELECT count(*) INTO v_count FROM (
        SELECT r.place_id,
          row_number() OVER (PARTITION BY r.place_id ORDER BY r.created_at ASC) AS rnk,
          count(*) OVER (PARTITION BY r.place_id) AS total,
          r.user_id
        FROM public.reviews r
      ) s
      WHERE s.total < 5 AND s.rnk <= v_threshold AND s.user_id = _user_id;
      v_meets := v_count >= 1;
    ELSIF v_type = 'profile_completed' THEN
      SELECT (avatar_url IS NOT NULL AND avatar_url <> '' AND bio IS NOT NULL AND length(trim(bio)) > 0)
        INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    -- ===== NEW: real data sources =====
    ELSIF v_type = 'beta_tester' THEN
      SELECT is_beta_tester INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    ELSIF v_type = 'returned_after_break' THEN
      SELECT (returned_after_break_at IS NOT NULL) INTO v_has_bool
      FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    ELSIF v_type = 'active_on_app_birthday' THEN
      SELECT (value->>'date')::date INTO v_app_birthday
      FROM public.site_settings WHERE key = 'app_birthday';
      IF v_app_birthday IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.reviews
        WHERE user_id = _user_id
          AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(MONTH FROM v_app_birthday)
          AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(DAY FROM v_app_birthday);
        v_meets := v_count >= 1;
      END IF;

    ELSIF v_type = 'challenges_completed' THEN
      SELECT count(*) INTO v_count FROM public.food_challenge_completions WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'reviews_with_video' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND video_url IS NOT NULL AND video_url <> '';
      v_meets := v_count >= v_threshold;

    -- discount codes / savings not implemented yet
    ELSIF v_type IN ('discount_codes_used','discount_savings_total') THEN
      v_meets := false;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- =====================================================
-- 5) Diagnostic function (admin-only) for verification
-- =====================================================
CREATE OR REPLACE FUNCTION public.debug_achievement_metrics(_user_id uuid)
RETURNS TABLE(slug text, type text, threshold text, meets boolean, current_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ach record;
  v_type text;
  v_threshold_txt text;
  v_val text;
  v_meets boolean;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR ach IN SELECT a.slug, a.criteria FROM public.achievements a WHERE a.enabled = true ORDER BY a.sort_order LOOP
    v_type := ach.criteria->>'type';
    v_threshold_txt := ach.criteria->>'threshold';
    v_val := NULL; v_meets := false;

    IF v_type = 'beta_tester' THEN
      SELECT is_beta_tester::text INTO v_val FROM public.profiles WHERE id = _user_id;
      v_meets := (v_val = 'true');
    ELSIF v_type = 'returned_after_break' THEN
      SELECT (returned_after_break_at IS NOT NULL)::text INTO v_val FROM public.profiles WHERE id = _user_id;
      v_meets := (v_val = 'true');
    ELSIF v_type = 'challenges_completed' THEN
      SELECT count(*)::text INTO v_val FROM public.food_challenge_completions WHERE user_id = _user_id;
      v_meets := v_val::int >= v_threshold_txt::int;
    ELSIF v_type = 'reviews_with_video' THEN
      SELECT count(*)::text INTO v_val FROM public.reviews WHERE user_id = _user_id AND video_url IS NOT NULL AND video_url <> '';
      v_meets := v_val::int >= v_threshold_txt::int;
    ELSIF v_type = 'ranking_position' THEN
      SELECT rnk::text INTO v_val FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0) s WHERE id = _user_id;
      v_meets := v_val IS NOT NULL AND v_val::int <= v_threshold_txt::int;
    ELSIF v_type = 'active_on_app_birthday' THEN
      SELECT count(*)::text INTO v_val FROM public.reviews r,
        (SELECT (value->>'date')::date d FROM public.site_settings WHERE key='app_birthday') s
        WHERE r.user_id = _user_id
          AND EXTRACT(MONTH FROM (r.created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(MONTH FROM s.d)
          AND EXTRACT(DAY FROM (r.created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(DAY FROM s.d);
      v_meets := COALESCE(v_val::int, 0) >= 1;
    ELSE
      v_val := '(computed in check_achievements)';
      v_meets := EXISTS (SELECT 1 FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug = ach.slug);
    END IF;

    RETURN QUERY SELECT ach.slug, v_type, v_threshold_txt, v_meets, v_val;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.debug_achievement_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_achievement_metrics(uuid) TO authenticated;

-- =====================================================
-- 6) Re-check every existing user so backfill triggers
-- =====================================================
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    PERFORM public.check_achievements(u);
  END LOOP;
END $$;

