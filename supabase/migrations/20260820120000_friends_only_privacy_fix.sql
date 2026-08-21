-- The "Profil publiczny" toggle in profile.tsx promises: public = everyone
-- sees your wall/place-lists, private = only your friends do. That promise
-- was never actually enforced at the data layer:
--   - place_visits and place_favorites had SELECT USING (true) — fully
--     open to anon, no is_public or friendship check at all. Verified live:
--     an anonymous curl against /rest/v1/place_visits returned every row in
--     the table (16/16), for every user, private or not.
--   - profiles "authenticated reads profiles" was USING (true) — any
--     logged-in user (not just friends) could read a private profile.
--   - user_achievements already had an is_public check but no friends tier,
--     inconsistent with the same "wall" it's rendered as part of.
--
-- This adds a friendship helper (same SECURITY DEFINER pattern as
-- has_role()) and reuses it everywhere "wall/listy miejsc" is read, so the
-- rule is actually: owner, or public profile, or accepted friend.

CREATE OR REPLACE FUNCTION public.is_friend_with(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = _user_id)
        OR (requester_id = _user_id AND addressee_id = auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_friend_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend_with(uuid) TO anon, authenticated;

-- place_visits
DROP POLICY IF EXISTS "place_visits public read" ON public.place_visits;
DROP POLICY IF EXISTS "place_visits authenticated read" ON public.place_visits;
CREATE POLICY "place_visits read own public or friend" ON public.place_visits
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = place_visits.user_id AND p.is_public = true)
  );

-- place_favorites
DROP POLICY IF EXISTS "Anyone can view favorites" ON public.place_favorites;
CREATE POLICY "place_favorites read own public or friend" ON public.place_favorites
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = place_favorites.user_id AND p.is_public = true)
  );

-- profiles: "authenticated reads profiles" ignored is_public entirely.
DROP POLICY IF EXISTS "authenticated reads profiles" ON public.profiles;
CREATE POLICY "authenticated reads own public or friend profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_public = true
    OR public.is_friend_with(id)
  );

-- user_achievements: add the same friends tier for consistency with the
-- rest of the "wall".
DROP POLICY IF EXISTS "user_achievements read own or public" ON public.user_achievements;
CREATE POLICY "user_achievements read own public or friend"
ON public.user_achievements FOR SELECT
TO anon, authenticated
USING (
  user_id = auth.uid()
  OR public.is_friend_with(user_id)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_achievements.user_id AND p.is_public = true
  )
);
