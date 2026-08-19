-- Reward the inviter with a modest one-time points bonus each time one of
-- their invite links is accepted by a new friend — on top of the existing
-- inviter/inviter_5/inviter_10 achievements (which already track this via
-- 'referrals_count' with no cap).
--
-- Anti-abuse: capped at the first 10 accepted invites per inviter (mirrors
-- the 'inviter_10' achievement's own tier ceiling), so even a determined
-- sockpuppet farmer nets at most 10 x rule points — economically
-- irrelevant. Reuses the existing admin-editable points_rules table, so the
-- reward can be tuned or disabled from the Punkty admin panel without a
-- code change.

INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('invite_accepted', 15, 'Za zaproszenie znajomego, który dołączył (max. 10 zaproszeń)')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.friend_invites_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rewarded_count int;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT count(*) INTO v_rewarded_count
    FROM public.points_transactions
    WHERE user_id = NEW.inviter_id AND event_key = 'invite_accepted' AND ref_type = 'friend_invite';
    IF v_rewarded_count < 10 THEN
      PERFORM public.award_points(NEW.inviter_id, 'invite_accepted', 'friend_invite', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.friend_invites_award_points() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER friend_invites_award_points_after_update
  AFTER UPDATE ON public.friend_invites
  FOR EACH ROW EXECUTE FUNCTION public.friend_invites_award_points();
