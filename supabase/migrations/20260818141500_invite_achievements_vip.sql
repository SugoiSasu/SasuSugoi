-- Friend-invite achievements (1/5/10 tiers) + VIP rank granted at tier 10.
--
-- The invite system itself (public.friend_invites, accept_friend_invite RPC)
-- and the 'referrals_count' criteria type in check_achievements() already
-- existed but had no UI and no trigger wiring anything up. This migration
-- closes that gap: retunes the existing 'inviter' achievement to threshold 1,
-- adds 5/10 tiers, fires check_achievements() when an invite is accepted, and
-- grants a 1-year VIP rank the moment the 10-tier achievement unlocks.

-- 1) Retune existing tier-1 and add tier-5 / tier-10.
UPDATE public.achievements
SET name = 'Plus jeden',
    description = 'Zaproś 1 znajomego, który dołączy do poŻeramy',
    criteria = '{"type":"referrals_count","threshold":1}'::jsonb
WHERE slug = 'inviter';

INSERT INTO public.achievements (slug, name, description, icon_url, criteria, sort_order, enabled) VALUES
  ('inviter_5',  'Rekruter smaku',      'Zaproś 5 znajomych, którzy dołączą do poŻeramy', '🎯', '{"type":"referrals_count","threshold":5}',  174, true),
  ('inviter_10', 'Ambasador poŻeramy',  'Zaproś 10 znajomych, którzy dołączą do poŻeramy — zgarniasz roczny status VIP',  '👑', '{"type":"referrals_count","threshold":10}', 175, true)
ON CONFLICT (slug) DO NOTHING;

-- 2) VIP columns on profiles (nick color reserved for a future settings UI).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_until timestamptz,
  ADD COLUMN IF NOT EXISTS vip_nick_color text;

-- 3) Recheck the inviter's achievements whenever one of their invites is
--    accepted (mirrors friendships_check_achievements' pattern).
CREATE OR REPLACE FUNCTION public.friend_invites_check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.check_achievements(NEW.inviter_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.friend_invites_check_achievements() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER friend_invites_achievements_after_update
  AFTER UPDATE ON public.friend_invites
  FOR EACH ROW EXECUTE FUNCTION public.friend_invites_check_achievements();

-- 4) Grant/renew a 1-year VIP rank the moment 'inviter_10' unlocks for a user.
CREATE OR REPLACE FUNCTION public.user_achievements_grant_vip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_slug text;
BEGIN
  SELECT slug INTO v_slug FROM public.achievements WHERE id = NEW.achievement_id;
  IF v_slug = 'inviter_10' THEN
    UPDATE public.profiles
    SET is_vip = true,
        vip_until = GREATEST(COALESCE(vip_until, now()), now()) + interval '1 year'
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.user_achievements_grant_vip() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_achievements_grant_vip_after_insert
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.user_achievements_grant_vip();
