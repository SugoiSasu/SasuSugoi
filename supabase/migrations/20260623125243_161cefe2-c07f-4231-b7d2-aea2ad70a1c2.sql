CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blog_comments_post_id_idx ON public.blog_comments(post_id, created_at DESC);

GRANT SELECT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments public read on published"
ON public.blog_comments FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.blog_posts bp
  WHERE bp.id = blog_comments.post_id AND bp.status = 'published'
));

CREATE POLICY "users insert own comments"
ON public.blog_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own comments"
ON public.blog_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own comments"
ON public.blog_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins moderate comments"
ON public.blog_comments FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
));

CREATE TRIGGER blog_comments_set_updated_at
BEFORE UPDATE ON public.blog_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

