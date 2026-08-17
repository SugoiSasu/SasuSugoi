-- Promote existing admins to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role
FROM public.user_roles
WHERE role = 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;

-- Helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
$$;

CREATE POLICY "super_admin reads all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super_admin inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admin deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super_admin reads all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin());

