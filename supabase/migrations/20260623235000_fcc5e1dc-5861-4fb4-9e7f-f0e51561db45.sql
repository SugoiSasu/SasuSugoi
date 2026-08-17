CREATE TABLE public.collab_submissions (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  email text not null,
  message text not null,
  consent_version text not null,
  consent_accepted_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now(),
  CONSTRAINT collab_consent_required CHECK (
    consent_version IS NOT NULL AND length(consent_version) > 0 AND consent_accepted_at IS NOT NULL
  ),
  CONSTRAINT collab_brand_len CHECK (char_length(brand) BETWEEN 2 AND 100),
  CONSTRAINT collab_email_len CHECK (char_length(email) BETWEEN 3 AND 200),
  CONSTRAINT collab_message_len CHECK (char_length(message) BETWEEN 10 AND 2000)
);

GRANT INSERT ON public.collab_submissions TO anon, authenticated;
GRANT ALL ON public.collab_submissions TO service_role;

ALTER TABLE public.collab_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit collab with consent"
ON public.collab_submissions FOR INSERT TO anon, authenticated
WITH CHECK (
  consent_version IS NOT NULL AND length(consent_version) > 0 AND consent_accepted_at IS NOT NULL
);

CREATE POLICY "Super admin can read collab submissions"
ON public.collab_submissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_submissions_created_idx ON public.collab_submissions (created_at DESC);

INSERT INTO public.achievements (slug, name, description, icon_url, criteria, enabled, sort_order)
VALUES
  ('ratatouille', 'Ratatouille', 'Kliknij w logo PoŻeramy 67 razy z rzędu', '🐀',
    '{"type":"logo_clicks","threshold":67,"hidden":true}'::jsonb, true, 100),
  ('night_owl', 'Nocny Marek', 'Dodaj recenzję między 23:00 a 3:00 w nocy', '🌙',
    '{"type":"review_at_night","threshold":1}'::jsonb, true, 101),
  ('lens_licker', 'Foodie fotograf', 'Dodaj zdjęcie do 20 różnych recenzji', '📸',
    '{"type":"reviews_with_photo","threshold":20}'::jsonb, true, 102),
  ('hot_streak', 'Passa żarłoka', 'Dodaj recenzję 7 dni z rzędu', '🔥',
    '{"type":"review_streak_days","threshold":7}'::jsonb, true, 103),
  ('district_king', 'Król dzielnicy', 'Zrecenzuj 10 lokali w tej samej dzielnicy', '👑',
    '{"type":"same_district_reviews","threshold":10}'::jsonb, true, 104),
  ('harsh_critic', 'Bez litości', 'Wystaw ocenę 1/5 pięciu różnym lokalom', '🌶️',
    '{"type":"one_star_reviews","threshold":5}'::jsonb, true, 105),
  ('taste_ambassador', 'Ambasador smaku', 'Zaproś 3 znajomych, którzy założą konto', '🤝',
    '{"type":"referrals","threshold":3}'::jsonb, true, 106),
  ('world_eater', 'Świat na talerzu', 'Zrecenzuj lokale 5 różnych kuchni świata', '🥢',
    '{"type":"distinct_cuisines","threshold":5}'::jsonb, true, 107),
  ('beta_tester', 'Szczur laboratoryjny', 'Byłeś z nami od samego początku', '🧪',
    '{"type":"manual","gold":true}'::jsonb, true, 108),
  ('pozaramy_legend', 'Legenda PoŻeramy', 'Zdobądź wszystkie inne achievementy', '🏆',
    '{"type":"all_achievements"}'::jsonb, true, 109)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
BEGIN
  FOR r IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := r.criteria->>'type';
    v_threshold := COALESCE((r.criteria->>'threshold')::int, 1);
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
      SELECT count(DISTINCT p.cuisine) INTO v_count
      FROM public.reviews r JOIN public.places p ON p.id = r.place_id
      WHERE r.user_id = _user_id AND p.cuisine IS NOT NULL AND p.cuisine <> '';
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
      VALUES (_user_id, r.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

