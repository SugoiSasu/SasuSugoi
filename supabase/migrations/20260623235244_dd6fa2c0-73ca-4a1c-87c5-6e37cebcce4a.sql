CREATE TYPE public.collab_status AS ENUM ('new', 'read', 'replied', 'archived');

ALTER TABLE public.collab_submissions
  ADD COLUMN status public.collab_status NOT NULL DEFAULT 'new',
  ADD COLUMN status_updated_at timestamptz,
  ADD COLUMN status_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN admin_notes text;

CREATE POLICY "Super admin can update collab submissions"
ON public.collab_submissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete collab submissions"
ON public.collab_submissions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_submissions_status_idx ON public.collab_submissions (status, created_at DESC);

