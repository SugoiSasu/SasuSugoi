-- VIP nickname color: users pick their own nick color (a stated VIP perk), but
-- RLS on `profiles` is row-level, not column-level — a non-VIP user could set
-- vip_nick_color directly via a client update to their own row. Enforce the
-- perk at the DB layer as defense-in-depth, independent of the UI gating.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_vip_nick_color_format
  CHECK (vip_nick_color IS NULL OR vip_nick_color ~ '^#[0-9a-fA-F]{6}$');

CREATE OR REPLACE FUNCTION public.enforce_vip_nick_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vip_nick_color IS NOT NULL
     AND NOT (NEW.is_vip AND (NEW.vip_until IS NULL OR NEW.vip_until > now())) THEN
    NEW.vip_nick_color := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_enforce_vip_nick_color
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vip_nick_color();
