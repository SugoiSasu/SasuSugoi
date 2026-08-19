-- profiles RLS is row-level, not column-level: the "own profile update" policy
-- only checks auth.uid() = id, so any authenticated user can currently PATCH
-- is_vip / vip_until / points_total / is_beta_tester on their own row directly
-- (self-granting VIP, beta access, and an arbitrary leaderboard score). This
-- mirrors the vip_nick_color guard added earlier in the session, but covers
-- the actually consequential columns.
--
-- Approach: a BEFORE UPDATE trigger resets these 4 columns to their OLD
-- values unless a transaction-local flag is set. The three legitimate
-- writers (award_points, admin_set_beta_tester, user_achievements_grant_vip)
-- are updated below to set that flag right before they touch profiles.
-- Clients talk to Postgres only through PostgREST (table CRUD + defined RPCs)
-- and can never issue a raw SET, so there is no way for a client request to
-- set the flag itself.

CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('pozeramy.allow_privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
    NEW.is_vip := OLD.is_vip;
    NEW.vip_until := OLD.vip_until;
    NEW.points_total := OLD.points_total;
    NEW.is_beta_tester := OLD.is_beta_tester;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged_columns();

-- Re-authorize the three legitimate writers.

CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid, _event_key text, _ref_type text, _ref_id uuid, _multiplier int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pts int;
BEGIN
  SELECT points INTO v_pts FROM public.points_rules WHERE event_key = _event_key AND enabled = true;
  IF v_pts IS NULL THEN RETURN; END IF;
  v_pts := v_pts * _multiplier;
  INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
  VALUES (_user_id, _event_key, v_pts, _ref_type, _ref_id);
  PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
  UPDATE public.profiles SET points_total = points_total + v_pts WHERE id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_reverse_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sum int;
BEGIN
  SELECT COALESCE(sum(points),0) INTO v_sum
  FROM public.points_transactions
  WHERE ref_type = 'review' AND ref_id = OLD.id;

  IF v_sum <> 0 THEN
    INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
    VALUES (OLD.user_id, 'review_deleted', -v_sum, 'review', OLD.id);
    PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
    UPDATE public.profiles SET points_total = points_total - v_sum WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_beta_tester(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
  UPDATE public.profiles SET is_beta_tester = COALESCE(_value, false) WHERE id = _user_id;
  PERFORM public.check_achievements(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_achievements_grant_vip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_slug text;
BEGIN
  SELECT slug INTO v_slug FROM public.achievements WHERE id = NEW.achievement_id;
  IF v_slug = 'inviter_10' THEN
    PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
    UPDATE public.profiles
    SET is_vip = true,
        vip_until = GREATEST(COALESCE(vip_until, now()), now()) + interval '1 year'
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
