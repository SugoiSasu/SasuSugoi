CREATE TABLE public.place_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

GRANT SELECT, INSERT, DELETE ON public.place_favorites TO authenticated;
GRANT SELECT ON public.place_favorites TO anon;
GRANT ALL ON public.place_favorites TO service_role;

ALTER TABLE public.place_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view favorites"
  ON public.place_favorites FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own favorites"
  ON public.place_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.place_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_place_favorites_user ON public.place_favorites(user_id);
CREATE INDEX idx_place_favorites_place ON public.place_favorites(place_id);

