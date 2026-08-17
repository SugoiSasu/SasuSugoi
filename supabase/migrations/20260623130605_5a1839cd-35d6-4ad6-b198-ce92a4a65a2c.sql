-- 1. Tighten user_roles INSERT: only super_admin can grant roles
DROP POLICY IF EXISTS "super_admin or first admin claim inserts roles" ON public.user_roles;

CREATE POLICY "super_admin inserts roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  );

-- 2. Restrict avatars read policy to authenticated owners only
DROP POLICY IF EXISTS "avatars users read own" ON storage.objects;

CREATE POLICY "avatars users read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

