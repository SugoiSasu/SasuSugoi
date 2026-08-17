CREATE POLICY "blog images public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-images');

CREATE POLICY "blog images admin write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE POLICY "blog images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE POLICY "blog images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

