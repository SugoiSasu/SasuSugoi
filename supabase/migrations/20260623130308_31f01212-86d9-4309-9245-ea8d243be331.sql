CREATE TABLE public.place_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  label text,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.place_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_locations TO authenticated;
GRANT ALL ON public.place_locations TO service_role;

ALTER TABLE public.place_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_locations public read"
  ON public.place_locations FOR SELECT
  USING (true);

CREATE POLICY "place_locations admin insert"
  ON public.place_locations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE POLICY "place_locations admin update"
  ON public.place_locations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE POLICY "place_locations admin delete"
  ON public.place_locations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE INDEX place_locations_place_id_idx ON public.place_locations(place_id);

CREATE TRIGGER place_locations_set_updated_at
  BEFORE UPDATE ON public.place_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

