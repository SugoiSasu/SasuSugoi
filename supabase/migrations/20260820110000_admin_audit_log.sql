-- Audit trail for sensitive admin actions (role grants/revokes, account
-- deletion, beta-tester flag). Previously these happened with zero record of
-- who did what — grant/revoke role was a bare client-side insert/delete on
-- user_roles, and deleteUserAccount left no trace at all. Writes only ever
-- happen through SECURITY DEFINER functions or service_role (server
-- functions), so the log itself can't be forged or tampered with by a client
-- that merely holds an admin/super_admin session.

CREATE TABLE public.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log(created_at DESC);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log(actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read it. No INSERT/UPDATE/DELETE policy for
-- authenticated/anon at all — append-only, and only via the paths below.
CREATE POLICY "super_admin reads audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

-- Replace the direct-table grant/revoke path with SECURITY DEFINER RPCs that
-- do the write and the audit-log insert atomically, so the two can't drift
-- (e.g. a client that writes the role but "forgets" to log it).
CREATE OR REPLACE FUNCTION public.admin_grant_role(_user_id UUID, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
    VALUES (auth.uid(), 'grant_role', _user_id, jsonb_build_object('role', _role));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(UUID, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id UUID, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
    VALUES (auth.uid(), 'revoke_role', _user_id, jsonb_build_object('role', _role));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(UUID, public.app_role) TO authenticated;

-- user_roles direct INSERT/DELETE from a client session is no longer needed
-- now that grant/revoke go through the RPCs above — drop the policies so
-- there is exactly one way to change a role, and it's always logged.
DROP POLICY IF EXISTS "super_admin inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin deletes roles" ON public.user_roles;

-- admin_set_beta_tester already exists (SECURITY DEFINER, super/admin-gated)
-- — extend it to also write the audit log, same pattern as the two above.
CREATE OR REPLACE FUNCTION public.admin_set_beta_tester(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM set_config('pozeramy.allow_privileged_profile_write', 'on', true);
  UPDATE public.profiles SET is_beta_tester = COALESCE(_value, false) WHERE id = _user_id;
  PERFORM public.check_achievements(_user_id);
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
    VALUES (auth.uid(), 'set_beta_tester', _user_id, jsonb_build_object('value', _value));
END;
$$;
