-- Security-definer helper to break RLS recursion on user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- Replace recursive policies on user_roles
DROP POLICY IF EXISTS "super_admin reads all roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin deletes roles" ON public.user_roles;

CREATE POLICY "super_admin reads all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin inserts roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin updates roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin deletes roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Clean up profiles policy that inlined the same EXISTS (no recursion there, but normalize via has_role)
DROP POLICY IF EXISTS "super_admin reads all profiles" ON public.profiles;
CREATE POLICY "super_admin reads all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

