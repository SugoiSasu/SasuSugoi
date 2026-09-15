-- useFavoriteCounts()/useFollowCounts() were pulling EVERY row of
-- place_favorites / place_follows down to the browser just to group them in
-- JavaScript. Both are read on high-traffic surfaces (place cards, the place
-- profile), so the payload grows with total app usage rather than with what
-- the page actually shows - the one query shape in the app guaranteed to get
-- worse the more successful the product is.
--
-- These do the grouping in Postgres and return one row per place. Both are
-- STABLE and read tables that are already publicly readable (the counts are
-- shown publicly anyway), so they stay callable by anon.

CREATE OR REPLACE FUNCTION public.place_favorite_counts()
RETURNS TABLE(place_id uuid, count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT place_id, count(*)::int
  FROM public.place_favorites
  GROUP BY place_id;
$$;

CREATE OR REPLACE FUNCTION public.place_follow_counts()
RETURNS TABLE(place_id uuid, count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT place_id, count(*)::int
  FROM public.place_follows
  GROUP BY place_id;
$$;

GRANT EXECUTE ON FUNCTION public.place_favorite_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_follow_counts()   TO anon, authenticated;
