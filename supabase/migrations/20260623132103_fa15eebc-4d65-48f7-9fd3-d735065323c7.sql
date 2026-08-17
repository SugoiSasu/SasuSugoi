-- review-photos: anyone can read (community photos), only owner uploads/manages
CREATE POLICY "review-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

CREATE POLICY "review-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "review-photos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "review-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  );

-- achievement-icons: anyone can read, only admins write
CREATE POLICY "achievement-icons public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-icons');

CREATE POLICY "achievement-icons admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

CREATE POLICY "achievement-icons admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

CREATE POLICY "achievement-icons admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

