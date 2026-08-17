-- Faza 0: usuń testowy rekord "testing" oraz dodaj flagę publikacji
DELETE FROM public.places WHERE id = '65d22dc8-6ee8-4396-95c7-59d39892a5a6';

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Nowo dodawane lokale trafiają domyślnie do szkiców
ALTER TABLE public.places ALTER COLUMN is_published SET DEFAULT false;

-- Publicznie widoczne tylko opublikowane; admini widzą wszystko (osobna polityka)
DROP POLICY IF EXISTS "places public read" ON public.places;
CREATE POLICY "places public read published"
  ON public.places FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "places admin read all"
  ON public.places FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

