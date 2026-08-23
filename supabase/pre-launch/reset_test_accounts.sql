-- ============================================================================
-- DO NOT RUN THIS AS PART OF THE NORMAL MIGRATION QUEUE.
-- This is a one-off pre-launch cleanup script, meant to run exactly once,
-- by hand, on the day the beta actually opens - not during development.
--
-- Deliberately kept OUTSIDE supabase/migrations/ so it can never be picked
-- up automatically by `supabase db push --linked` - that command applies
-- every file in the migrations folder in order, with no way to opt a file
-- out, so this being anywhere in there is a live risk of it firing during
-- an unrelated routine push. To actually run this at launch time: open the
-- Supabase Dashboard -> SQL Editor, paste this file's contents, read it
-- once more, and execute it manually.
--
-- What it does:
--   1. Tags every account that currently has real activity (points, a
--      review, a wall post, an achievement, or a visited place) as a
--      Beta Tester (profiles.is_beta_tester = true) - so their early
--      participation stays recognized even after their gameplay data
--      is wiped below. Per project_beta_tester_achievement memory, this
--      recognition already exists as a concept; this just applies it in
--      bulk instead of one profile at a time.
--   2. Wipes: points_transactions + profiles.points_total, reviews (and
--      review_comments/review_reactions/review_replies via FK cascade),
--      place_favorites, place_visits, user_achievements,
--      user_challenge_completions, wall_posts (and wall_reactions/
--      wall_comments via FK cascade).
--   3. Exempts exactly one account from all of the above: the owner
--      account with email sugoi.biznes@gmail.com - untouched, no wipe,
--      no beta-tester tag (already the admin/owner, not a tester).
--
-- Explicitly NOT touched (confirm before adding, don't assume):
--   - places, cuisines, achievements/challenges definitions - product data,
--     not user activity.
--   - place_follows, place_posts/place_post_comments/place_post_reactions -
--     these are place-owner-authored content and place-follow subscriptions,
--     not "testing activity"; wiping them would delete real business content.
--   - friendships/friend_* tables - not selected for wipe; testers may want
--     to keep their social graph. Add explicitly if that's wrong.
--   - profiles rows themselves are never deleted, only zeroed out - nobody
--     loses their account/login.
--
-- Re-verify the exact table list against the live schema before running -
-- this was drafted against the schema as of 2026-08-22 and the app was
-- still under active development when it was written.
-- ============================================================================

DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'sugoi.biznes@gmail.com';
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner account (sugoi.biznes@gmail.com) not found - aborting before touching any data.';
  END IF;

  -- 1) Tag everyone with real activity as a Beta Tester, except the owner.
  UPDATE public.profiles p
  SET is_beta_tester = true
  WHERE p.id <> v_owner_id
    AND (
      p.points_total > 0
      OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.user_id = p.id)
      OR EXISTS (SELECT 1 FROM public.wall_posts w WHERE w.user_id = p.id)
      OR EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = p.id)
      OR EXISTS (SELECT 1 FROM public.place_visits pv WHERE pv.user_id = p.id)
    );

  -- 2) Wipe gameplay/testing data for everyone except the owner.
  DELETE FROM public.points_transactions WHERE user_id <> v_owner_id;
  UPDATE public.profiles SET points_total = 0 WHERE id <> v_owner_id;

  DELETE FROM public.reviews WHERE user_id <> v_owner_id;
  DELETE FROM public.place_favorites WHERE user_id <> v_owner_id;
  DELETE FROM public.place_visits WHERE user_id <> v_owner_id;

  DELETE FROM public.user_achievements WHERE user_id <> v_owner_id;
  DELETE FROM public.user_challenge_completions WHERE user_id <> v_owner_id;

  DELETE FROM public.wall_posts WHERE user_id <> v_owner_id;
  -- wall_reactions/wall_comments aren't exclusively tied to wall_posts (kind
  -- can be 'favorite'/'achievement_group'/'list'/'challenge_complete' too),
  -- so clear the user's own reactions/comments directly rather than relying
  -- only on the wall_posts cascade.
  DELETE FROM public.wall_reactions WHERE user_id <> v_owner_id;
  DELETE FROM public.wall_comments WHERE user_id <> v_owner_id;

  RAISE NOTICE 'Pre-launch reset complete. Owner account % left untouched.', v_owner_id;
END $$;
