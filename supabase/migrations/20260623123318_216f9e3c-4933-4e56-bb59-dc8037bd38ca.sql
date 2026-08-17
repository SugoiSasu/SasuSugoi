-- ============================================================
-- 1. Recreate every policy that referenced has_role/is_super_admin
--    with inline EXISTS checks, so we can drop the helper funcs.
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "super_admin reads all profiles" ON public.profiles;
CREATE POLICY "super_admin reads all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- user_roles
DROP POLICY IF EXISTS "super_admin deletes roles" ON public.user_roles;
CREATE POLICY "super_admin deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
));

DROP POLICY IF EXISTS "super_admin inserts roles" ON public.user_roles;
-- Replacement: super_admin OR first-admin self-claim when no admin exists yet
CREATE POLICY "super_admin or first admin claim inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
  OR (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  )
);

DROP POLICY IF EXISTS "super_admin reads all roles" ON public.user_roles;
CREATE POLICY "super_admin reads all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
));

-- places
DROP POLICY IF EXISTS "places admin delete" ON public.places;
CREATE POLICY "places admin delete"
ON public.places FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "places admin insert" ON public.places;
CREATE POLICY "places admin insert"
ON public.places FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "places admin update" ON public.places;
CREATE POLICY "places admin update"
ON public.places FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- blog_posts
DROP POLICY IF EXISTS "blog admin delete" ON public.blog_posts;
CREATE POLICY "blog admin delete"
ON public.blog_posts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "blog admin insert" ON public.blog_posts;
CREATE POLICY "blog admin insert"
ON public.blog_posts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "blog admin read all" ON public.blog_posts;
CREATE POLICY "blog admin read all"
ON public.blog_posts FOR SELECT TO authenticated
USING (
  status = 'published'::post_status
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "blog admin update" ON public.blog_posts;
CREATE POLICY "blog admin update"
ON public.blog_posts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- social_accounts (rebuild every policy that referenced is_super_admin)
DROP POLICY IF EXISTS "Super admin can read social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can read social accounts"
ON public.social_accounts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can delete social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can delete social accounts"
ON public.social_accounts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can insert social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can insert social accounts"
ON public.social_accounts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can update social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can update social accounts"
ON public.social_accounts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- ============================================================
-- 2. Drop the no-longer-referenced SECURITY DEFINER helpers
-- ============================================================
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.claim_first_admin();

-- ============================================================
-- 3. Lock down handle_new_user — only the trigger needs it
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

