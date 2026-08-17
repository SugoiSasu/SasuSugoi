-- 1) Extend places with contact/practical info + structured menu/hours
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS price_range TEXT,
  ADD COLUMN IF NOT EXISTS has_takeaway BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS menu_items JSONB;

-- 2) Cuisines table (admin editable)
CREATE TABLE IF NOT EXISTS public.cuisines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cuisines TO anon, authenticated;
GRANT ALL ON public.cuisines TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.cuisines TO authenticated;
ALTER TABLE public.cuisines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuisines readable by all" ON public.cuisines;
CREATE POLICY "cuisines readable by all" ON public.cuisines FOR SELECT USING (true);
DROP POLICY IF EXISTS "cuisines manageable by super admin" ON public.cuisines;
CREATE POLICY "cuisines manageable by super admin" ON public.cuisines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS cuisines_set_updated_at ON public.cuisines;
CREATE TRIGGER cuisines_set_updated_at
  BEFORE UPDATE ON public.cuisines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cuisines (name, emoji, color, sort_order) VALUES
  ('Włoska',      '🍕', '#3b4cc7', 10),
  ('Amerykańska', '🌭', '#5b6cf0', 20),
  ('Kebaby',      '🌯', '#e26a3a', 30),
  ('Azjatycka',   '🍜', '#d4582a', 40),
  ('Śniadania',   '🍳', '#f0b840', 50),
  ('Słodkości',   '🍦', '#e89aab', 60),
  ('Polska',      '🥟', '#c4416a', 70),
  ('Meksykańska', '🌮', '#3aa56b', 80),
  ('Wegańska',    '🥗', '#3aa56b', 90),
  ('Burgery',     '🍔', '#e35d2e', 100),
  ('Ramen',       '🍲', '#8e5cd9', 110),
  ('Sushi',       '🍣', '#e35d2e', 120),
  ('Mix',         '✨', '#3b4cc7', 999)
ON CONFLICT (name) DO NOTHING;

-- 3) Place suggestions (public form → admin approval)
CREATE TABLE IF NOT EXISTS public.place_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  cuisine TEXT,
  website TEXT,
  instagram TEXT,
  notes TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.place_suggestions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.place_suggestions TO authenticated;
GRANT ALL ON public.place_suggestions TO service_role;
ALTER TABLE public.place_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit suggestion" ON public.place_suggestions;
CREATE POLICY "anyone can submit suggestion" ON public.place_suggestions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "super admin reads suggestions" ON public.place_suggestions;
CREATE POLICY "super admin reads suggestions" ON public.place_suggestions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin updates suggestions" ON public.place_suggestions;
CREATE POLICY "super admin updates suggestions" ON public.place_suggestions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin deletes suggestions" ON public.place_suggestions;
CREATE POLICY "super admin deletes suggestions" ON public.place_suggestions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS place_suggestions_set_updated_at ON public.place_suggestions;
CREATE TRIGGER place_suggestions_set_updated_at
  BEFORE UPDATE ON public.place_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Rating breakdown helper (used by profile stars distribution)
CREATE OR REPLACE FUNCTION public.place_rating_breakdown(_place_id UUID)
RETURNS TABLE(rating INT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s AS rating, COALESCE(c.cnt, 0)::bigint AS count
  FROM generate_series(1,5) s
  LEFT JOIN (
    SELECT r.rating::int AS rating, count(*)::bigint AS cnt
    FROM public.reviews r
    WHERE r.place_id = _place_id
    GROUP BY r.rating
  ) c ON c.rating = s
  ORDER BY s DESC;
$$;
GRANT EXECUTE ON FUNCTION public.place_rating_breakdown(UUID) TO anon, authenticated;

