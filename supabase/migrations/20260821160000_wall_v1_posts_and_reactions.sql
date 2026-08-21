-- Pożeralnia (wall) redesign, Etap 1:
--   1. wall_posts - user-authored quick posts ("co dziś jadłeś?"), the seed
--      for the "quick post" bar at the top of the wall. Deliberately generic
--      (short body + optional place + optional photo) so Etap 2's "check-in"
--      can reuse this same table without another migration.
--   2. wall_reactions / wall_comments - a single generic, polymorphic social
--      layer keyed by (kind, ref_id), used ONLY for the wall item kinds that
--      currently have no social affordance at all: 'favorite',
--      'achievement_group' (client-side-grouped achievement unlocks - see
--      wall-api.ts), and the new 'post' kind. 'review' and 'place_post' keep
--      their existing, already-working review_reactions/review_comments and
--      place_post_reactions/place_post_comments stacks untouched - this is
--      not a unification of those, just filling the two gaps.
-- ref_id is `text`, not `uuid`, because 'achievement_group' has no real
-- backing row - its ref_id is the synthetic key `${user_id}:${day}` computed
-- identically client-side and in wall_item_owner() below.

-- 1) wall_posts
CREATE TABLE public.wall_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_posts_user_created_idx ON public.wall_posts(user_id, created_at DESC);
CREATE INDEX wall_posts_place_idx ON public.wall_posts(place_id);
GRANT SELECT ON public.wall_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_posts TO authenticated;
GRANT ALL ON public.wall_posts TO service_role;
ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_posts public read" ON public.wall_posts FOR SELECT USING (true);
CREATE POLICY "wall_posts insert own" ON public.wall_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wall_posts update own" ON public.wall_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wall_posts delete own" ON public.wall_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER wall_posts_set_updated_at BEFORE UPDATE ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: resolve which user "owns" a wall item, for block-checks and
-- reaction/comment notifications. Returns NULL (fail-open on the block
-- check, no notification sent) rather than raising, since ref_id is
-- client-supplied text and may not parse as a uuid.
CREATE OR REPLACE FUNCTION public.wall_item_owner(_kind text, _ref_id text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF _kind = 'favorite' THEN
    SELECT user_id INTO v_owner FROM public.place_favorites WHERE id = _ref_id::uuid;
  ELSIF _kind = 'achievement' THEN
    SELECT user_id INTO v_owner FROM public.user_achievements WHERE id = _ref_id::uuid;
  ELSIF _kind = 'achievement_group' THEN
    v_owner := split_part(_ref_id, ':', 1)::uuid;
  ELSIF _kind = 'post' THEN
    SELECT user_id INTO v_owner FROM public.wall_posts WHERE id = _ref_id::uuid;
  END IF;
  RETURN v_owner;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- 2) wall_reactions
-- Synthetic `id` PK (not a composite of kind/ref_id/user_id/type) so a
-- reaction-type swap is a plain single-row UPDATE by id, matching
-- place_post_reactions' shape rather than review_reactions' (which has no
-- swap-in-place path and relies on the client doing delete+insert instead).
CREATE TABLE public.wall_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('favorite', 'achievement', 'achievement_group', 'post')),
  ref_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('yum', 'must_try', 'love')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id, user_id, type)
);
CREATE INDEX wall_reactions_item_idx ON public.wall_reactions(kind, ref_id);
GRANT SELECT ON public.wall_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_reactions TO authenticated;
GRANT ALL ON public.wall_reactions TO service_role;
ALTER TABLE public.wall_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_reactions public read" ON public.wall_reactions FOR SELECT USING (true);
CREATE POLICY "wall_reactions insert self" ON public.wall_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_blocked(auth.uid(), public.wall_item_owner(kind, ref_id))
  );
CREATE POLICY "wall_reactions update self" ON public.wall_reactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "wall_reactions delete self" ON public.wall_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- notify item owner on reaction
CREATE OR REPLACE FUNCTION public.wall_reactions_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_who text;
BEGIN
  v_owner := public.wall_item_owner(NEW.kind, NEW.ref_id);
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktoś') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'wall_reaction', 'Nowa reakcja na Pożeralni',
    v_who || ' zareagował(a) na Twój wpis',
    '/wall', 'wall', NULL);
  RETURN NEW;
END $$;
CREATE TRIGGER wall_reactions_notify_ins AFTER INSERT ON public.wall_reactions
  FOR EACH ROW EXECUTE FUNCTION public.wall_reactions_notify();

-- 3) wall_comments
CREATE TABLE public.wall_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('favorite', 'achievement', 'achievement_group', 'post')),
  ref_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_comments_item_idx ON public.wall_comments(kind, ref_id, created_at DESC);
GRANT SELECT ON public.wall_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_comments TO authenticated;
GRANT ALL ON public.wall_comments TO service_role;
ALTER TABLE public.wall_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_comments public read" ON public.wall_comments FOR SELECT USING (true);
CREATE POLICY "wall_comments insert self" ON public.wall_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_blocked(auth.uid(), public.wall_item_owner(kind, ref_id))
  );
CREATE POLICY "wall_comments update self" ON public.wall_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "wall_comments delete self or item owner" ON public.wall_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.wall_item_owner(kind, ref_id) = auth.uid());
CREATE TRIGGER wall_comments_set_updated_at BEFORE UPDATE ON public.wall_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- notify item owner on comment
CREATE OR REPLACE FUNCTION public.wall_comments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_who text;
BEGIN
  v_owner := public.wall_item_owner(NEW.kind, NEW.ref_id);
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktoś') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'wall_comment', 'Nowy komentarz na Pożeralni',
    v_who || ' skomentował(a) Twój wpis',
    '/wall', 'wall', NULL);
  RETURN NEW;
END $$;
CREATE TRIGGER wall_comments_notify_ins AFTER INSERT ON public.wall_comments
  FOR EACH ROW EXECUTE FUNCTION public.wall_comments_notify();

-- 4) small points incentive for using the quick-post bar (mirrors reviews'
-- award_points/points_rules pattern - configurable/disableable from admin).
INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('wall_post_created', 5, 'Za dodanie wpisu na Pożeralni')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.wall_posts_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 'wall_post_created', 'wall_post', NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER wall_posts_award_ins AFTER INSERT ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.wall_posts_award_on_insert();

-- Realtime, matching the review_reactions/review_comments precedent.
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_comments;
