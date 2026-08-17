CREATE TABLE public.ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]{2,30}$'),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#e35d2e',
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranks TO authenticated;
GRANT ALL ON public.ranks TO service_role;

ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ranks public read" ON public.ranks FOR SELECT USING (true);
CREATE POLICY "ranks super_admin insert" ON public.ranks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "ranks super_admin update" ON public.ranks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "ranks super_admin delete" ON public.ranks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role)
    AND is_system = false
  );

CREATE TRIGGER ranks_set_updated_at BEFORE UPDATE ON public.ranks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.user_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank_id uuid NOT NULL REFERENCES public.ranks(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rank_id)
);

GRANT SELECT ON public.user_ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ranks TO authenticated;
GRANT ALL ON public.user_ranks TO service_role;

ALTER TABLE public.user_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ranks public read" ON public.user_ranks FOR SELECT USING (true);
CREATE POLICY "user_ranks super_admin insert" ON public.user_ranks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "user_ranks super_admin delete" ON public.user_ranks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));

CREATE INDEX user_ranks_user_id_idx ON public.user_ranks(user_id);

-- Seed system rank "pożeramy" and assign to Head Admin (Mateusz)
INSERT INTO public.ranks (slug, name, color, icon, description, sort_order, is_system)
VALUES ('pozeramy', 'pożeramy', '#e35d2e', '🍕', 'Head Admin i właściciel platformy', 0, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_ranks (user_id, rank_id, granted_by)
SELECT '89e4e471-4931-43b9-8622-f0bfa5718c73'::uuid, r.id, '89e4e471-4931-43b9-8622-f0bfa5718c73'::uuid
FROM public.ranks r WHERE r.slug = 'pozeramy'
ON CONFLICT DO NOTHING;

