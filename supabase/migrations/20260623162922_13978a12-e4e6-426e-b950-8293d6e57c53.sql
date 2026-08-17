-- Ads UPDATE: add WITH CHECK to ensure updates persist for super_admin
DROP POLICY IF EXISTS "ads super update" ON public.ads;
CREATE POLICY "ads super update" ON public.ads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Storage policies for ad-images bucket
DROP POLICY IF EXISTS "ad-images read all" ON storage.objects;
CREATE POLICY "ad-images read all" ON storage.objects
  FOR SELECT USING (bucket_id = 'ad-images');

DROP POLICY IF EXISTS "ad-images super insert" ON storage.objects;
CREATE POLICY "ad-images super insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "ad-images super update" ON storage.objects;
CREATE POLICY "ad-images super update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "ad-images super delete" ON storage.objects;
CREATE POLICY "ad-images super delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

