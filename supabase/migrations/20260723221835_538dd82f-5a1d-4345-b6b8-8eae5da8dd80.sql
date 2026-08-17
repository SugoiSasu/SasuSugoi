CREATE OR REPLACE FUNCTION public.run_achievement_tests()
RETURNS TABLE(test_name text, status text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_user3 uuid := gen_random_uuid();
  v_place uuid;
  v_challenge uuid;
  v_extra_challenges uuid[] := ARRAY[]::uuid[];
  v_ach_reel uuid;
  v_ach_ca uuid;
  v_ach_cm uuid;
  v_has boolean;
  i int;
  v_cid uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  SELECT id INTO v_ach_reel FROM public.achievements WHERE slug = 'reel_maker';
  SELECT id INTO v_ach_ca   FROM public.achievements WHERE slug = 'challenge_accepted';
  SELECT id INTO v_ach_cm   FROM public.achievements WHERE slug = 'challenge_maniac';

  -- Create auth users + profiles
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  VALUES
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-reel-'||v_user1||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-ca-'||v_user2||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false),
    (v_user3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-cm-'||v_user3||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false);

  INSERT INTO public.profiles (id, display_name) VALUES
    (v_user1, 'test-reel'), (v_user2, 'test-ca'), (v_user3, 'test-cm')
  ON CONFLICT (id) DO NOTHING;

  -- Test place
  INSERT INTO public.places (name, cuisine, address, lat, lng, slug, is_published)
  VALUES ('__test_place__', 'test', 'test', 52.4, 16.9, '__test_place_'||gen_random_uuid()::text, false)
  RETURNING id INTO v_place;

  -- Ensure at least 10 challenges exist for challenge_maniac
  SELECT id INTO v_challenge FROM public.food_challenges LIMIT 1;
  IF v_challenge IS NULL THEN
    FOR i IN 1..10 LOOP
      INSERT INTO public.food_challenges (title, description, enabled, sort_order)
      VALUES ('__test_ch_'||i, 'test', true, 9000+i)
      RETURNING id INTO v_cid;
      v_extra_challenges := v_extra_challenges || v_cid;
    END LOOP;
  ELSE
    -- Ensure we have 10 total; create the rest
    FOR i IN 1..10 - (SELECT count(*)::int FROM public.food_challenges) LOOP
      INSERT INTO public.food_challenges (title, description, enabled, sort_order)
      VALUES ('__test_ch_'||i, 'test', true, 9000+i)
      RETURNING id INTO v_cid;
      v_extra_challenges := v_extra_challenges || v_cid;
    END LOOP;
  END IF;

  -- ============================================================
  -- TEST 1: reel_maker requires video_url; photo-only does not count
  -- ============================================================
  -- Insert 5 reviews with photo but NO video
  FOR i IN 1..5 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, photo_url, video_url)
    VALUES (v_place, v_user1, 5, 'r'||i, 'https://example.com/p.jpg', NULL);
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_photo_only_should_not_unlock'::text, 'FAIL'::text, 'unlocked despite no video_url'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_photo_only_should_not_unlock'::text, 'PASS'::text, '5 photo reviews did not unlock reel_maker'::text;
  END IF;

  -- Add 4 video reviews (total 4 < 5) — still should not unlock
  FOR i IN 1..4 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
    VALUES (v_place, v_user1, 5, 'v'||i, 'https://example.com/v'||i||'.mp4');
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_below_threshold_should_not_unlock'::text, 'FAIL'::text, '4 video reviews unlocked reel_maker'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_below_threshold_should_not_unlock'::text, 'PASS'::text, '4 video reviews did not unlock'::text;
  END IF;

  -- Add 5th video review → threshold met
  INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
  VALUES (v_place, v_user1, 5, 'v5', 'https://example.com/v5.mp4');

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_at_threshold_should_unlock'::text, 'PASS'::text, '5 video reviews unlocked reel_maker'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_at_threshold_should_unlock'::text, 'FAIL'::text, '5 video reviews did NOT unlock'::text;
  END IF;

  -- Additional guard: empty-string video_url must not count
  DELETE FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_reel;
  FOR i IN 1..5 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
    VALUES (v_place, v_user2, 5, 'e'||i, '');
  END LOOP;
  PERFORM public.check_achievements(v_user2);
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_empty_string_video_should_not_unlock'::text, 'FAIL'::text, 'empty video_url counted'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_empty_string_video_should_not_unlock'::text, 'PASS'::text, 'empty string ignored'::text;
  END IF;

  -- ============================================================
  -- TEST 2: challenge_accepted (>=1) and challenge_maniac (>=10)
  -- ============================================================
  SELECT id INTO v_challenge FROM public.food_challenges ORDER BY sort_order, id LIMIT 1;

  -- Before any completions
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_ca) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_accepted_zero_should_not_unlock'::text, 'FAIL'::text, 'unlocked with 0 completions'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_accepted_zero_should_not_unlock'::text, 'PASS'::text, 'no completions, locked'::text;
  END IF;

  -- 1 completion → challenge_accepted unlocks (trigger runs check_achievements)
  INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user2, v_challenge);

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_ca) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_accepted_one_should_unlock'::text, 'PASS'::text, '1 completion unlocked'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_accepted_one_should_unlock'::text, 'FAIL'::text, '1 completion did NOT unlock'::text;
  END IF;

  -- challenge_maniac should NOT be unlocked yet
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_below_should_not_unlock'::text, 'FAIL'::text, 'unlocked at 1'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_below_should_not_unlock'::text, 'PASS'::text, '1 completion locked'::text;
  END IF;

  -- Complete 9 distinct challenges for user3 (below threshold)
  FOR v_cid IN SELECT id FROM public.food_challenges ORDER BY sort_order, id LIMIT 9 LOOP
    INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user3, v_cid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user3 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_nine_should_not_unlock'::text, 'FAIL'::text, '9 unlocked cm'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_nine_should_not_unlock'::text, 'PASS'::text, '9 completions locked cm'::text;
  END IF;

  -- 10th completion → challenge_maniac unlocks
  FOR v_cid IN SELECT id FROM public.food_challenges ORDER BY sort_order, id OFFSET 9 LIMIT 1 LOOP
    INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user3, v_cid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user3 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_ten_should_unlock'::text, 'PASS'::text, '10 completions unlocked cm'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_ten_should_unlock'::text, 'FAIL'::text, '10 completions did NOT unlock cm'::text;
  END IF;

  -- ============================================================
  -- CLEANUP
  -- ============================================================
  DELETE FROM public.food_challenge_completions WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.reviews WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.user_achievements WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.points_transactions WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.places WHERE id = v_place;
  IF array_length(v_extra_challenges, 1) > 0 THEN
    DELETE FROM public.food_challenges WHERE id = ANY(v_extra_challenges);
  END IF;
  DELETE FROM public.profiles WHERE id IN (v_user1, v_user2, v_user3);
  DELETE FROM auth.users WHERE id IN (v_user1, v_user2, v_user3);
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_achievement_tests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_achievement_tests() TO service_role;

