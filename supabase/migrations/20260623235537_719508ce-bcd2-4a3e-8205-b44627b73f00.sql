CREATE TABLE public.collab_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.collab_submissions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_replies_body_len CHECK (char_length(body) BETWEEN 1 AND 10000),
  CONSTRAINT collab_replies_channel_chk CHECK (channel IN ('email','phone','note','other'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_replies TO authenticated;
GRANT ALL ON public.collab_replies TO service_role;

ALTER TABLE public.collab_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read collab replies"
ON public.collab_replies FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can insert collab replies"
ON public.collab_replies FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND author_id = auth.uid());

CREATE POLICY "Super admin can update collab replies"
ON public.collab_replies FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete collab replies"
ON public.collab_replies FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_replies_submission_idx ON public.collab_replies (submission_id, sent_at DESC);

