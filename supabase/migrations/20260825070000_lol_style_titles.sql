-- Selectable player titles (LoL-style), plan approved 2026-08-25.
-- Players choose ONE title from achievements they've unlocked that carry
-- one, shown next to their name on their profile, Ranking (list+podium),
-- and Friends. Not automatic - the player picks, matching the design
-- principle that made this worth copying from League of Legends.

-- 1. Achievements get a category (organizes the existing 71 badges into
--    5 groups) and an optional title (only a curated subset of stronger
--    achievements are "wearable" - not every badge, so the choice stays
--    meaningful instead of diluted).
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS title text;

UPDATE public.achievements SET category = CASE
  WHEN criteria->>'type' IN (
    'unique_places', 'unique_places_in_district', 'unique_districts',
    'distinct_cuisines', 'first_review_new_place', 'early_reviewer_rank',
    'reviews_same_day', 'reviews_premium'
  ) THEN 'odkrywca'
  WHEN criteria->>'type' IN (
    'reviews_count', 'review_length', 'long_reviews_count',
    'reviews_with_photo', 'reviews_with_video', 'reviews_this_month',
    'review_streak_days', 'one_star_reviews', 'review_likes_max',
    'review_likes_total'
  ) OR criteria->>'type' LIKE 'reviews_cuisine_%' THEN 'recenzent'
  WHEN criteria->>'type' IN (
    'friends_count', 'referrals', 'referrals_count', 'comments_count'
  ) THEN 'spolecznosc'
  WHEN criteria->>'type' IN (
    'points_total', 'ranking_position', 'all_achievements',
    'challenges_completed', 'discount_codes_used', 'discount_savings_total'
  ) THEN 'kolekcjoner'
  ELSE 'weteran'
END
WHERE category IS NULL;

UPDATE public.achievements a SET title = v.title
FROM (VALUES
  ('pozeramy_legend', 'Legenda poŻeramy'),
  ('point_monster', 'Punktowy Potwór'),
  ('number_one', 'Numer Jeden'),
  ('top_ten', 'Elita Rankingu'),
  ('knows_every_corner', 'Zna Każdy Kąt'),
  ('sushi_master', 'Mistrz Sushi'),
  ('pizzaiolo_fan', 'Pizzaiolo'),
  ('kebab_king', 'Król Kebaba'),
  ('burger_boss', 'Burger Boss'),
  ('vege_warrior', 'Wege Wojownik'),
  ('sweet_tooth', 'Słodki Ząbek'),
  ('coffee_connoisseur', 'Kawowy Koneser'),
  ('omnivore', 'Wszystkożerny'),
  ('fine_dining_club', 'Smakosz Fine Dining'),
  ('night_owl', 'Nocny Marek'),
  ('early_bird', 'Ranny Ptaszek'),
  ('streak_thirty', 'Żelazna Passa'),
  ('whole_crew', 'Dusza Towarzystwa'),
  ('inviter_10', 'Ambasador poŻeramy'),
  ('trusted_voice', 'Zaufany Głos'),
  ('district_king', 'Król Dzielnicy'),
  ('hidden_gem_hunter', 'Łowca Sekretnych Lokali'),
  ('beta_legend', 'Weteran Bety'),
  ('found_yourself', 'To Ty!')
) AS v(slug, title)
WHERE a.slug = v.slug;

-- 2. Profile columns: the reference (which achievement is active - lets the
--    picker UI show current selection and re-validate ownership) and a
--    denormalized display copy (avoids a join on every place display_name
--    already renders - profile header, Ranking, Friends).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_title_achievement_id uuid
    REFERENCES public.achievements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_title text;

-- 3. These two columns need the same protection as is_vip/points_total/etc
--    (see 20260819130000_guard_privileged_profile_columns.sql) - profiles
--    RLS is row-level only, so without this a client could PATCH
--    active_title to arbitrary text directly, bypassing the ownership
--    check in set_active_title() below.
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('pozeramy.allow_privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
    NEW.is_vip := OLD.is_vip;
    NEW.vip_until := OLD.vip_until;
    NEW.points_total := OLD.points_total;
    NEW.is_beta_tester := OLD.is_beta_tester;
    NEW.active_title_achievement_id := OLD.active_title_achievement_id;
    NEW.active_title := OLD.active_title;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. The only legitimate writer: validates the caller actually unlocked an
--    achievement that has a title before letting them wear it. Pass NULL to
--    clear the active title.
CREATE OR REPLACE FUNCTION public.set_active_title(_achievement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_title text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF _achievement_id IS NULL THEN
    PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
    UPDATE public.profiles
    SET active_title_achievement_id = NULL, active_title = NULL
    WHERE id = v_uid;
    RETURN;
  END IF;

  SELECT a.title INTO v_title
  FROM public.achievements a
  JOIN public.user_achievements ua
    ON ua.achievement_id = a.id AND ua.user_id = v_uid
  WHERE a.id = _achievement_id AND a.title IS NOT NULL;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'achievement_not_owned_or_no_title';
  END IF;

  PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
  UPDATE public.profiles
  SET active_title_achievement_id = _achievement_id, active_title = v_title
  WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_title(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_title(uuid) TO authenticated;

-- 5. friend_leaderboard (extended earlier today for VIP/avatar parity
--    between the Ranking page's Wszyscy/Znajomi scopes) needs active_title
--    too, or titles would only show in the global scope and disappear when
--    switching to Znajomi - the exact kind of inconsistency that scope
--    toggle was built to eliminate.
DROP FUNCTION IF EXISTS public.friend_leaderboard(uuid);

CREATE OR REPLACE FUNCTION public.friend_leaderboard(_user uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  avatar_source text,
  is_vip boolean,
  vip_until timestamptz,
  vip_nick_color text,
  active_title text,
  points_total int,
  reviews_count int,
  achievements_count int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT _user AS uid
    UNION
    SELECT friend_id FROM public.friends_of(_user)
  )
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.avatar_source,
    COALESCE(p.is_vip, false),
    p.vip_until,
    p.vip_nick_color,
    p.active_title,
    COALESCE(p.points_total, 0)::int,
    (SELECT count(*)::int FROM public.reviews r WHERE r.user_id = p.id),
    (SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = p.id)
  FROM ids
  JOIN public.profiles p ON p.id = ids.uid
  ORDER BY COALESCE(p.points_total, 0) DESC;
$$;

REVOKE ALL ON FUNCTION public.friend_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard(uuid) TO authenticated;
