ALTER TABLE public.place_post_reactions DROP CONSTRAINT IF EXISTS place_post_reactions_reaction_type_check;
ALTER TABLE public.place_post_reactions
  ADD CONSTRAINT place_post_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','yum','wow','fire','heart'));

DELETE FROM public.place_post_reactions r
USING public.place_post_reactions r2
WHERE r.post_id = r2.post_id
  AND r.user_id = r2.user_id
  AND r.created_at < r2.created_at;

ALTER TABLE public.place_post_reactions
  DROP CONSTRAINT IF EXISTS place_post_reactions_post_id_user_id_reaction_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS place_post_reactions_post_user_uniq
  ON public.place_post_reactions(post_id, user_id);

GRANT UPDATE ON public.place_post_reactions TO authenticated;

DROP POLICY IF EXISTS "post_reactions update own" ON public.place_post_reactions;
CREATE POLICY "post_reactions update own" ON public.place_post_reactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

