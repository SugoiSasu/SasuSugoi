-- 1) Revoke broad EXECUTE on SECURITY DEFINER functions, then grant only what's needed.
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.friendships_check_achievements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_reverse_on_delete() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

REVOKE EXECUTE ON FUNCTION public.get_friends_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_count(uuid) TO authenticated, anon, service_role;

-- 2) Restrict user_achievements / user_ranks read to authenticated.
DROP POLICY IF EXISTS "user_achievements public read" ON public.user_achievements;
CREATE POLICY "user_achievements authenticated read" ON public.user_achievements
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_ranks public read" ON public.user_ranks;
CREATE POLICY "user_ranks authenticated read" ON public.user_ranks
FOR SELECT TO authenticated USING (true);

-- 3) Allow public read of avatar images so other users can see profile pictures.
CREATE POLICY "avatars public read" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');

