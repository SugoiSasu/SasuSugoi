CREATE TYPE public.place_visit_status AS ENUM ('want', 'visited');

CREATE TABLE public.place_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  status public.place_visit_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id, status)
);

CREATE INDEX place_visits_user_status_idx ON public.place_visits (user_id, status);
CREATE INDEX place_visits_place_idx ON public.place_visits (place_id);

GRANT SELECT ON public.place_visits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_visits TO authenticated;
GRANT ALL ON public.place_visits TO service_role;

ALTER TABLE public.place_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_visits public read"
  ON public.place_visits FOR SELECT
  USING (true);

CREATE POLICY "place_visits insert own"
  ON public.place_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "place_visits update own"
  ON public.place_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "place_visits delete own"
  ON public.place_visits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER place_visits_set_updated_at
  BEFORE UPDATE ON public.place_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

