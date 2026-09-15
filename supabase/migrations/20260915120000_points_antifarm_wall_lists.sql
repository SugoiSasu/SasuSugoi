-- Points for wall posts (+5) and lists (+8) were the only award paths with
-- neither a cap nor a reversal, unlike reviews (one per place via the UNIQUE
-- constraint, reversed on delete) and invites (hard cap of 10). That made the
-- whole points economy inflatable: post one character, collect 5 points,
-- delete the post, repeat - the points stayed. Since points_total drives the
-- level, the avatar ring tier and the leaderboard, an unbounded farm devalues
-- all three for everyone who earned them honestly.
--
-- Two guards, mirroring patterns already in the schema:
--  1) AFTER DELETE reversal, the shape reviews_reverse_on_delete() already uses.
--  2) A daily cap on how many of each event can be rewarded, the shape
--     friend_invites_award_points() already uses for the invite cap - enforced
--     inside the trigger (same transaction, row-locked), so a direct PostgREST
--     call can't bypass it the way a client-side check could.
--
-- Deliberately NOT a rate limit on posting itself: users may write as many
-- posts and lists as they like, only the reward stops past the daily cap.

-- How many rewarded events of each kind per user per rolling 24h.
INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('wall_post_daily_cap', 5, 'Limit nagradzanych wpisow na Pozeralni (24h)'),
  ('list_daily_cap',      2, 'Limit nagradzanych list tematycznych (24h)')
ON CONFLICT DO NOTHING;

-- Generic helper: has this user already hit the rolling-24h cap for this event?
CREATE OR REPLACE FUNCTION public.points_daily_cap_reached(
  _user_id uuid, _event_key text, _cap_key text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cap int;
  v_count int;
BEGIN
  SELECT points INTO v_cap FROM public.points_rules
  WHERE event_key = _cap_key AND enabled = true;
  -- No cap row (or an admin disabled it) means uncapped, matching how
  -- award_points() treats a missing/disabled rule as "no award configured".
  IF v_cap IS NULL THEN RETURN false; END IF;

  SELECT count(*) INTO v_count
  FROM public.points_transactions
  WHERE user_id = _user_id
    AND event_key = _event_key
    AND points > 0                       -- reversals must not free up quota
    AND created_at >= now() - interval '24 hours';

  RETURN v_count >= v_cap;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.points_daily_cap_reached(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- Shared reversal: subtract whatever was awarded for this exact row and log
-- the reversal in the ledger, so points_total stays reconstructible from
-- points_transactions.
CREATE OR REPLACE FUNCTION public.reverse_points_for_ref(
  _user_id uuid, _ref_type text, _ref_id uuid, _reversal_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sum int;
BEGIN
  SELECT COALESCE(sum(points), 0) INTO v_sum
  FROM public.points_transactions
  WHERE ref_type = _ref_type AND ref_id = _ref_id;

  IF v_sum <> 0 THEN
    INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
    VALUES (_user_id, _reversal_key, -v_sum, _ref_type, _ref_id);
    PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
    UPDATE public.profiles SET points_total = points_total - v_sum WHERE id = _user_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reverse_points_for_ref(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- wall posts

CREATE OR REPLACE FUNCTION public.wall_posts_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.points_daily_cap_reached(NEW.user_id, 'wall_post_created', 'wall_post_daily_cap') THEN
    PERFORM public.award_points(NEW.user_id, 'wall_post_created', 'wall_post', NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.wall_posts_reverse_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reverse_points_for_ref(OLD.user_id, 'wall_post', OLD.id, 'wall_post_deleted');
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.wall_posts_reverse_on_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS wall_posts_reverse_del ON public.wall_posts;
CREATE TRIGGER wall_posts_reverse_del
  AFTER DELETE ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.wall_posts_reverse_on_delete();

-- --------------------------------------------------------------------- lists

CREATE OR REPLACE FUNCTION public.place_lists_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.points_daily_cap_reached(NEW.user_id, 'list_created', 'list_daily_cap') THEN
    PERFORM public.award_points(NEW.user_id, 'list_created', 'place_list', NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.place_lists_reverse_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reverse_points_for_ref(OLD.user_id, 'place_list', OLD.id, 'list_deleted');
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.place_lists_reverse_on_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS place_lists_reverse_del ON public.place_lists;
CREATE TRIGGER place_lists_reverse_del
  AFTER DELETE ON public.place_lists
  FOR EACH ROW EXECUTE FUNCTION public.place_lists_reverse_on_delete();
