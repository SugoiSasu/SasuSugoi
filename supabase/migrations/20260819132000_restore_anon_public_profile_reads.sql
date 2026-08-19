-- Same bug class as the get_friends_count/friends_of fix earlier this
-- session: GRANT SELECT ... TO anon was never revoked on these three
-- tables, but a later migration narrowed the RLS SELECT policy to
-- TO authenticated only — so anon queries don't error, they just silently
-- return nothing. All three are queried unconditionally by public pages:
--   - place_owners: /k/$id "verified owner" badge (public place page)
--   - user_achievements: /u/$username achievement badges (public profile)
--   - place_visits: /u/$username "visited"/"want to visit" lists (public profile)

DROP POLICY IF EXISTS "place_owners authenticated read verified" ON public.place_owners;
CREATE POLICY "place_owners public read verified" ON public.place_owners
  FOR SELECT TO anon, authenticated
  USING (verified = true);

DROP POLICY IF EXISTS "user_achievements read own or public" ON public.user_achievements;
CREATE POLICY "user_achievements read own or public"
ON public.user_achievements FOR SELECT
TO anon, authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_achievements.user_id AND p.is_public = true
  )
);

DROP POLICY IF EXISTS "place_visits authenticated read" ON public.place_visits;
CREATE POLICY "place_visits public read"
ON public.place_visits FOR SELECT
TO anon, authenticated
USING (true);
