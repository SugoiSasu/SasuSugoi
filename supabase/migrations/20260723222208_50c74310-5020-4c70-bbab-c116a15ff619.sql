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
  UPDATE public.profiles SET is_beta_tester = COALESCE(_value, false) WHERE id = _user_id;
  PERFORM public.check_achievements(_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_beta_tester(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_beta_tester(uuid, boolean) TO authenticated;

