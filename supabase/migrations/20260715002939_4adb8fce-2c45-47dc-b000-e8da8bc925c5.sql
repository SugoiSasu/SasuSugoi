GRANT SELECT ON public.place_post_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_post_reactions TO authenticated;
GRANT ALL ON public.place_post_reactions TO service_role;

DROP POLICY IF EXISTS "post_reactions public read" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions insert own" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions update own" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions delete own" ON public.place_post_reactions;

CREATE POLICY "post_reactions public read"
ON public.place_post_reactions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "post_reactions insert own"
ON public.place_post_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions update own"
ON public.place_post_reactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions delete own"
ON public.place_post_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

