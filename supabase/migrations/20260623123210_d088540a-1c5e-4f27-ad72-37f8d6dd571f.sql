-- 1. Lock down public exposure of social_accounts to safe columns via a view
DROP POLICY IF EXISTS "Public can read active social accounts" ON public.social_accounts;

CREATE OR REPLACE VIEW public.social_accounts_public
WITH (security_invoker = true)
AS
SELECT platform, handle, profile_url, followers_count, posts_count, is_active
FROM public.social_accounts
WHERE is_active = true;

GRANT SELECT ON public.social_accounts_public TO anon, authenticated;

-- Allow super-admins to still read the full table via the API
CREATE POLICY "Super admin can read social accounts"
ON public.social_accounts FOR SELECT TO authenticated
USING (public.is_super_admin());

REVOKE SELECT ON public.social_accounts FROM anon;

-- 2. Lock down SECURITY DEFINER function execution to the roles that need them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- handle_new_user is invoked by a trigger on auth.users — no role grants needed

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- 3. Restrict avatars bucket read access — clients fetch via signed URLs anyway
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars users read own"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

