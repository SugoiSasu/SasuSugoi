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
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    v_threshold := COALESCE((ach.criteria->>'threshold')::int, 1);
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
      grp AS (
        SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days
      ),
      streaks AS (
        SELECT count(*)::int AS len FROM grp GROUP BY g
      )
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
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

