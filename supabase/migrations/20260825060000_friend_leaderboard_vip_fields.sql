-- Ranking page redesign (2026-08-25): unifies /u into a single ranking UI
-- with a "Wszyscy / Znajomi" scope toggle instead of two divergent ranking
-- UIs (the global /u page and the separate Znajomi > Ranking tab). The
-- shared podium/list renderer needs the same fields for both scopes -
-- friend_leaderboard was missing avatar_source and VIP fields that the
-- global ranking query already selects, so VIP badges/avatar rendering
-- were inconsistent between the two.
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
    COALESCE(p.points_total, 0)::int,
    (SELECT count(*)::int FROM public.reviews r WHERE r.user_id = p.id),
    (SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = p.id)
  FROM ids
  JOIN public.profiles p ON p.id = ids.uid
  ORDER BY COALESCE(p.points_total, 0) DESC;
$$;
