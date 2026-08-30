-- "Zapisz" (save) on Pożeralnia feed items - a private per-user bookmark on
-- any WallItem. item_key is the client's synthetic WallItem.id (e.g.
-- "review-<uuid>", "wp-<uuid>", "achg-<userId>-<date>") rather than a raw
-- foreign key, since the wall aggregates rows from several source tables
-- (reviews, place_posts, wall posts, lists, achievement groups, ...) with no
-- single shared id space and some synthetic ids aren't even a single UUID.
CREATE TABLE public.wall_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

GRANT SELECT, INSERT, DELETE ON public.wall_saves TO authenticated;
GRANT ALL ON public.wall_saves TO service_role;

ALTER TABLE public.wall_saves ENABLE ROW LEVEL SECURITY;

-- Private: unlike favorites/reactions, saves are a personal reading-list and
-- not shown on anyone else's profile, so only the owner can see their own.
CREATE POLICY "Users can view their own saves"
  ON public.wall_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own saves"
  ON public.wall_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own saves"
  ON public.wall_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_wall_saves_user ON public.wall_saves(user_id);
