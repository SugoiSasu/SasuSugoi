-- ============================================
-- 1) Extend check_achievements with new metric types
-- ============================================
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
  v_threshold_bool boolean;
  v_total_other int;
  v_user_other int;
  v_cuisine_pattern text;
  v_has_bool boolean;
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    -- Numeric threshold (default 1). Bool threshold read separately below.
    v_threshold := COALESCE(NULLIF(ach.criteria->>'threshold','true'), NULLIF(ach.criteria->>'threshold','false'), '1')::int;
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

    -- ===== NEW METRIC TYPES =====

    ELSIF v_type = 'reviews_this_month' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw')
          = date_trunc('month', (now() AT TIME ZONE 'Europe/Warsaw'));
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'first_review_new_place' THEN
      SELECT count(*) INTO v_count
      FROM public.reviews r
      WHERE r.user_id = _user_id
        AND NOT EXISTS (
          SELECT 1 FROM public.reviews r2
          WHERE r2.place_id = r.place_id AND r2.created_at < r.created_at
        );
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'unique_places_in_district' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(DISTINCT r.place_id) AS cnt
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> ''
        GROUP BY pl.district
      ) s;
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
        ELSE NULL
      END;
      IF v_cuisine_pattern IS NOT NULL THEN
        SELECT count(*) INTO v_count
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.cuisine ~* v_cuisine_pattern;
        v_meets := v_count >= v_threshold;
      END IF;

    ELSIF v_type = 'reviews_premium' THEN
      SELECT count(*) INTO v_count
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.price_range ~ '\$\$\$\$';
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'ranking_position' THEN
      -- inverse: user_rank <= threshold
      SELECT rnk INTO v_count FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0
      ) s WHERE id = _user_id;
      IF v_count IS NOT NULL THEN
        v_meets := v_count <= v_threshold;
      END IF;

    ELSIF v_type = 'review_likes_max' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.review_reactions rr
        JOIN public.reviews r ON r.id = rr.review_id
        WHERE r.user_id = _user_id
        GROUP BY rr.review_id
      ) s;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_likes_total' THEN
      SELECT count(*) INTO v_count FROM public.review_reactions rr
      JOIN public.reviews r ON r.id = rr.review_id
      WHERE r.user_id = _user_id;
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
      FROM public.reviews
      WHERE user_id = _user_id
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
        SELECT count(*) AS cnt FROM public.reviews
        WHERE user_id = _user_id
        GROUP BY (created_at AT TIME ZONE 'Europe/Warsaw')::date
      ) s;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'early_reviewer_rank' THEN
      -- user is among first N reviewers of a place that has <5 total reviews
      SELECT count(*) INTO v_count FROM (
        SELECT r.place_id,
               row_number() OVER (PARTITION BY r.place_id ORDER BY r.created_at ASC) AS rnk,
               count(*) OVER (PARTITION BY r.place_id) AS total
        FROM public.reviews r
      ) s
      WHERE s.total < 5 AND s.rnk <= v_threshold
        AND EXISTS (SELECT 1 FROM public.reviews rx WHERE rx.place_id = s.place_id AND rx.user_id = _user_id);
      v_meets := v_count >= 1;

    ELSIF v_type = 'profile_completed' THEN
      SELECT (avatar_url IS NOT NULL AND avatar_url <> '' AND bio IS NOT NULL AND length(trim(bio)) > 0)
        INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    -- Metrics without a data source yet — kept as no-op so the badge exists in UI
    -- and will start awarding once the feature ships (challenges, discount codes,
    -- video reviews, beta cohort, app birthday, returned-after-break session tracking).
    ELSIF v_type IN (
      'reviews_with_video',
      'challenges_completed',
      'discount_codes_used',
      'discount_savings_total',
      'returned_after_break',
      'beta_tester',
      'active_on_app_birthday'
    ) THEN
      v_meets := false;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- ============================================
-- 2) Insert 50 new achievements (skip on slug conflict)
-- ============================================
INSERT INTO public.achievements (slug, name, description, icon_url, criteria, sort_order, enabled) VALUES
  ('warming_up','Rozkręcony','Dodaj 25 recenzji','🔥','{"type":"reviews_count","threshold":25}',110,true),
  ('pro_reviewer','Zawodowiec','Dodaj 50 recenzji','🥇','{"type":"reviews_count","threshold":50}',111,true),
  ('pozeramy_legend','Legenda PoŻeramy','Dodaj 250 recenzji','👑','{"type":"reviews_count","threshold":250}',112,true),
  ('reviewer_of_year','Recenzent roku','Dodaj 12 recenzji w jednym miesiącu','📅','{"type":"reviews_this_month","threshold":12}',113,true),
  ('flavor_cartographer','Kartograf smaku','Odwiedź 10 różnych lokali','🗺️','{"type":"unique_places","threshold":10}',120,true),
  ('poznan_magellan','Poznański Magellan','Odwiedź 25 różnych lokali','🧭','{"type":"unique_places","threshold":25}',121,true),
  ('knows_every_corner','Zna każdy kąt','Odwiedź 50 różnych lokali','🏙️','{"type":"unique_places","threshold":50}',122,true),
  ('first_to_arrive','Pierwszy na miejscu','Dodaj pierwszą recenzję nowo dodanego lokalu','🚀','{"type":"first_review_new_place","threshold":1}',123,true),
  ('district_regular','Dzielnicowy ziomek','Odwiedź 5 różnych lokali w jednej dzielnicy','📍','{"type":"unique_places_in_district","threshold":5}',124,true),
  ('gastro_tourist','Turysta gastronomiczny','Odwiedź lokale w 5 różnych dzielnicach Poznania','🧳','{"type":"unique_districts","threshold":5}',125,true),
  ('sushi_master','Sushi master','Oceń 10 lokali z kuchnią japońską','🍣','{"type":"reviews_cuisine_japanese","threshold":10}',130,true),
  ('pizzaiolo_fan','Pizzaiolo','Oceń 10 pizzerii','🍕','{"type":"reviews_cuisine_pizza","threshold":10}',131,true),
  ('kebab_king','Kebab king','Oceń 10 kebabowni','🥙','{"type":"reviews_cuisine_kebab","threshold":10}',132,true),
  ('ramen_runner','Ramen runner','Oceń 5 lokali z ramenem','🍜','{"type":"reviews_cuisine_ramen","threshold":5}',133,true),
  ('burger_boss','Burger boss','Oceń 10 lokali z burgerami','🍔','{"type":"reviews_cuisine_burger","threshold":10}',134,true),
  ('vege_warrior','Wege wojownik','Oceń 10 lokali wegetariańskich lub wegańskich','🥦','{"type":"reviews_cuisine_vege","threshold":10}',135,true),
  ('sweet_tooth','Słodki ząbek','Oceń 10 cukierni lub lodziarni','🍨','{"type":"reviews_cuisine_dessert","threshold":10}',136,true),
  ('coffee_connoisseur','Kawowy koneser','Oceń 10 kawiarni','☕','{"type":"reviews_cuisine_coffee","threshold":10}',137,true),
  ('world_cuisine','Kuchnia świata','Oceń lokale z 8 różnych kuchni','🌍','{"type":"distinct_cuisines","threshold":8}',138,true),
  ('fine_dining_club','Fine dining club','Oceń 5 lokali z segmentu premium','🥂','{"type":"reviews_premium","threshold":5}',139,true),
  ('half_thousand','Pół tysiąca','Zdobądź 500 punktów PoŻarcia','5️⃣','{"type":"points_total","threshold":500}',140,true),
  ('thousand_club','Klub Tysiąca','Zdobądź 1000 punktów PoŻarcia','🔟','{"type":"points_total","threshold":1000}',141,true),
  ('point_monster','Punktowy potwór','Zdobądź 5000 punktów PoŻarcia','👹','{"type":"points_total","threshold":5000}',142,true),
  ('top_ten','Top 10','Wejdź do top 10 rankingu PoŻeramy','🏆','{"type":"ranking_position","threshold":10}',143,true),
  ('number_one','Numer jeden','Zajmij 1. miejsce w rankingu PoŻeramy','🥇','{"type":"ranking_position","threshold":1}',144,true),
  ('streak_seven','Streak 7 dni','Dodawaj recenzje przez 7 dni z rzędu','📆','{"type":"review_streak_days","threshold":7}',150,true),
  ('streak_thirty','Streak 30 dni','Dodawaj recenzje przez 30 dni z rzędu','🗓️','{"type":"review_streak_days","threshold":30}',151,true),
  ('squad_goals','Paczka ziomków','Miej 10 znajomych','👥','{"type":"friends_count","threshold":10}',160,true),
  ('whole_crew','Ekipa na mieście','Miej 25 znajomych','🎉','{"type":"friends_count","threshold":25}',161,true),
  ('food_influencer','Wpływowy foodie','Twoja recenzja dostanie 50 polubień','📢','{"type":"review_likes_max","threshold":50}',170,true),
  ('trusted_voice','Zaufany głos','Twoje recenzje zbiorą łącznie 500 polubień','🙌','{"type":"review_likes_total","threshold":500}',171,true),
  ('commenter','Komentator','Skomentuj 20 recenzji innych userów','💬','{"type":"comments_count","threshold":20}',172,true),
  ('inviter','Zapraszacz','Zaproś 3 znajomych, którzy dołączą do PoŻeramy','📨','{"type":"referrals_count","threshold":3}',173,true),
  ('photo_reporter','Fotoreporter','Dodaj zdjęcia do 50 recenzji','📸','{"type":"reviews_with_photo","threshold":50}',180,true),
  ('heartfelt_review','Recenzja z sercem','Napisz recenzję dłuższą niż 300 znaków','❤️','{"type":"review_length","threshold":300}',181,true),
  ('wordy_critic','Gadatliwy krytyk','Napisz 10 recenzji dłuższych niż 300 znaków','✍️','{"type":"long_reviews_count","threshold":10}',182,true),
  ('reel_maker','Filmowiec','Dodaj 5 recenzji z filmikiem','🎬','{"type":"reviews_with_video","threshold":5}',183,true),
  ('early_bird','Ranny ptaszek','Dodaj recenzję między 6:00 a 9:00','🌅','{"type":"review_before_9am","threshold":1}',190,true),
  ('weekend_hunter','Weekendowy łowca','Dodaj recenzje w 5 różnych weekendy','🍻','{"type":"weekend_reviews","threshold":5}',191,true),
  ('lunch_ritual','Lunchowy rytuał','Dodaj 10 recenzji lokali odwiedzonych w porze lunchu (12-15)','🥪','{"type":"reviews_lunch_time","threshold":10}',192,true),
  ('valentine_foodie','Walentynkowy foodie','Dodaj recenzję 14 lutego','💘','{"type":"review_on_valentines","threshold":1}',193,true),
  ('new_years_feast','Sylwestrowa uczta','Dodaj recenzję 31 grudnia','🥂','{"type":"review_on_nye","threshold":1}',194,true),
  ('pozeramy_anniversary','Rocznica PoŻeramy','Bądź aktywny w appce w dniu jej urodzin','🎂','{"type":"active_on_app_birthday","threshold":1}',195,true),
  ('challenge_accepted','Challenge accepted','Ukończ swój pierwszy food challenge','✅','{"type":"challenges_completed","threshold":1}',200,true),
  ('challenge_maniac','Challenge maniak','Ukończ 10 food challengy','🏅','{"type":"challenges_completed","threshold":10}',201,true),
  ('code_hunter','Łowca kodów','Wykorzystaj 5 kodów rabatowych','🎟️','{"type":"discount_codes_used","threshold":5}',210,true),
  ('budget_foodie','Oszczędny smakosz','Zaoszczędź łącznie 100 zł dzięki kodom rabatowym','💰','{"type":"discount_savings_total","threshold":100}',211,true),
  ('profile_complete','Kompletny profil','Uzupełnij zdjęcie profilowe i bio','🪪','{"type":"profile_completed","threshold":true}',220,true),
  ('comeback_kid','Powracający','Wróć do appki po 30 dniach przerwy i dodaj recenzję','🔁','{"type":"returned_after_break","threshold":1}',221,true),
  ('beta_legend','Beta tester','Byłeś testerem PoŻeramy w fazie beta','🧪','{"type":"beta_tester","threshold":true}',222,true),
  ('hidden_gem_hunter','Sekretny lokal','Oceń lokal z <5 recenzjami jako jeden z pierwszych 3 recenzentów','💎','{"type":"early_reviewer_rank","threshold":3}',230,true),
  ('omnivore','Wszystkożerny','Oceń lokale z 15 różnych kuchni','🐗','{"type":"distinct_cuisines","threshold":15}',231,true),
  ('flavor_route','Marszruta smaku','Odwiedź 3 lokale w jeden dzień i dodaj recenzje','🛵','{"type":"reviews_same_day","threshold":3}',232,true)
ON CONFLICT (slug) DO NOTHING;

