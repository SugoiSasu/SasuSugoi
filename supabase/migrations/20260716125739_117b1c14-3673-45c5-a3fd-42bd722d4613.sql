-- Photos gallery for places
CREATE TABLE public.place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.place_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_photos TO authenticated;
GRANT ALL ON public.place_photos TO service_role;

ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place photos"
  ON public.place_photos FOR SELECT
  USING (true);

CREATE POLICY "Admins and verified owners can insert photos"
  ON public.place_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE POLICY "Admins and verified owners can update photos"
  ON public.place_photos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE POLICY "Admins and verified owners can delete photos"
  ON public.place_photos FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE TRIGGER place_photos_updated_at
  BEFORE UPDATE ON public.place_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX place_photos_place_idx ON public.place_photos(place_id, sort_order);

-- Storage policies on the private place-photos bucket:
-- public read via signed URLs is handled at request time; here we allow authenticated read of metadata
-- and restrict uploads to admins / verified owners.
CREATE POLICY "Public can read place-photos objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-photos');

CREATE POLICY "Admins and owners can upload place-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

CREATE POLICY "Admins and owners can update place-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

CREATE POLICY "Admins and owners can delete place-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

