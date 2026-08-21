-- Pożeralnia (wall) redesign, Etap 3 + 4:
--   1. place_lists / place_list_items - user-curated named place collections
--      ("najlepszy street food w Poznaniu"), shown on the wall as a new
--      'list' item kind, reusing the generic wall_reactions/wall_comments
--      social layer from Etap 1 (extending its kind CHECK constraint).
--   2. challenges / user_challenge_completions - time-windowed goals
--      ("tydzień kebabu"), evaluated from a user's `reviews` on insert,
--      mirroring the existing award_points()/check_achievements() engine
--      pattern. Completion also uses the generic wall social layer
--      ('challenge_complete' kind).

-- 1) place_lists
CREATE TABLE public.place_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX place_lists_user_created_idx ON public.place_lists(user_id, created_at DESC);
GRANT SELECT ON public.place_lists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_lists TO authenticated;
GRANT ALL ON public.place_lists TO service_role;
ALTER TABLE public.place_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_lists public read" ON public.place_lists FOR SELECT USING (true);
CREATE POLICY "place_lists insert own" ON public.place_lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "place_lists update own" ON public.place_lists
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "place_lists delete own" ON public.place_lists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER place_lists_set_updated_at BEFORE UPDATE ON public.place_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) place_list_items
CREATE TABLE public.place_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.place_lists(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  sort_order int NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, place_id)
);
CREATE INDEX place_list_items_list_idx ON public.place_list_items(list_id, sort_order);
GRANT SELECT ON public.place_list_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_list_items TO authenticated;
GRANT ALL ON public.place_list_items TO service_role;
ALTER TABLE public.place_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_list_items public read" ON public.place_list_items FOR SELECT USING (true);
CREATE POLICY "place_list_items owner write" ON public.place_list_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.place_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.place_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

-- 3) extend the Etap-1 generic wall social layer to cover 'list' and
-- 'challenge_complete' kinds too.
ALTER TABLE public.wall_reactions DROP CONSTRAINT wall_reactions_kind_check;
ALTER TABLE public.wall_reactions ADD CONSTRAINT wall_reactions_kind_check
  CHECK (kind IN ('favorite', 'achievement', 'achievement_group', 'post', 'list', 'challenge_complete'));

ALTER TABLE public.wall_comments DROP CONSTRAINT wall_comments_kind_check;
ALTER TABLE public.wall_comments ADD CONSTRAINT wall_comments_kind_check
  CHECK (kind IN ('favorite', 'achievement', 'achievement_group', 'post', 'list', 'challenge_complete'));

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
  ELSIF _kind = 'list' THEN
    SELECT user_id INTO v_owner FROM public.place_lists WHERE id = _ref_id::uuid;
  ELSIF _kind = 'challenge_complete' THEN
    SELECT user_id INTO v_owner FROM public.user_challenge_completions WHERE id = _ref_id::uuid;
  END IF;
  RETURN v_owner;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- notify list owner on new list item? not needed - list authoring is
-- self-directed, only reactions/comments (already wired generically) notify.

ALTER PUBLICATION supabase_realtime ADD TABLE public.place_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.place_list_items;

-- 4) points for creating a list
INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('list_created', 8, 'Za utworzenie listy tematycznej')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.place_lists_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 'list_created', 'place_list', NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER place_lists_award_ins AFTER INSERT ON public.place_lists
  FOR EACH ROW EXECUTE FUNCTION public.place_lists_award_on_insert();

-- 5) challenges
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  -- {"type": "cuisine_reviews"|"new_places_reviewed"|"unique_cuisines_reviewed", "cuisine": text?, "threshold": int, "window_days": int}
  criteria jsonb NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges public read" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "challenges admin write" ON public.challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER challenges_set_updated_at BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) user_challenge_completions
CREATE TABLE public.user_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);
CREATE INDEX user_challenge_completions_user_idx ON public.user_challenge_completions(user_id, completed_at DESC);
GRANT SELECT ON public.user_challenge_completions TO anon, authenticated;
GRANT ALL ON public.user_challenge_completions TO service_role;
ALTER TABLE public.user_challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_challenge_completions public read" ON public.user_challenge_completions FOR SELECT USING (true);
-- No client insert policy: only check_challenges() (SECURITY DEFINER) writes here.

INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('challenge_completed', 25, 'Za ukończenie wyzwania')
ON CONFLICT DO NOTHING;

-- 7) evaluation engine, mirrors check_achievements()'s shape.
CREATE OR REPLACE FUNCTION public.check_challenges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  v_count int;
  v_since timestamptz;
  v_completion_id uuid;
BEGIN
  FOR c IN
    SELECT * FROM public.challenges
    WHERE enabled = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
      AND NOT EXISTS (
        SELECT 1 FROM public.user_challenge_completions
        WHERE user_id = _user_id AND challenge_id = challenges.id
      )
  LOOP
    v_since := now() - make_interval(days => COALESCE((c.criteria->>'window_days')::int, 30));
    v_count := 0;

    IF c.criteria->>'type' = 'cuisine_reviews' THEN
      SELECT count(*) INTO v_count
      FROM public.reviews r JOIN public.places p ON p.id = r.place_id
      WHERE r.user_id = _user_id AND r.created_at >= v_since
        AND p.cuisine = c.criteria->>'cuisine';
    ELSIF c.criteria->>'type' = 'new_places_reviewed' THEN
      SELECT count(DISTINCT r.place_id) INTO v_count
      FROM public.reviews r
      WHERE r.user_id = _user_id AND r.created_at >= v_since;
    ELSIF c.criteria->>'type' = 'unique_cuisines_reviewed' THEN
      SELECT count(DISTINCT p.cuisine) INTO v_count
      FROM public.reviews r JOIN public.places p ON p.id = r.place_id
      WHERE r.user_id = _user_id AND r.created_at >= v_since;
    ELSE
      CONTINUE;
    END IF;

    IF v_count >= COALESCE((c.criteria->>'threshold')::int, 999999) THEN
      INSERT INTO public.user_challenge_completions (user_id, challenge_id)
      VALUES (_user_id, c.id)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_completion_id;

      IF v_completion_id IS NOT NULL THEN
        PERFORM public.award_points(_user_id, 'challenge_completed', 'challenge', c.id);
        PERFORM public.notify(
          _user_id, 'challenge_completed',
          'Wyzwanie ukończone! 🏆',
          'Ukończyłeś wyzwanie: ' || c.title,
          '/wall', 'challenge', c.id
        );
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reviews_check_challenges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_challenges(NEW.user_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reviews_check_challenges_ins ON public.reviews;
CREATE TRIGGER reviews_check_challenges_ins AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_check_challenges();

-- Starter challenges (admins can edit/add more from /admin/gamifikacja).
INSERT INTO public.challenges (slug, title, description, icon, criteria, sort_order) VALUES
  ('tydzien-kebabu', 'Tydzień kebabu', 'Oceń 3 kebaby w 7 dni.', '🥙',
    '{"type":"cuisine_reviews","cuisine":"Kebaby","threshold":3,"window_days":7}', 10),
  ('piec-nowych-knajp', 'Pięć nowych knajp', 'Oceń 5 różnych lokali w 31 dni.', '🍽️',
    '{"type":"new_places_reviewed","threshold":5,"window_days":31}', 20),
  ('trasa-kuchni-swiata', 'Trasa kuchni świata', 'Oceń lokale z 7 różnych kuchni w 90 dni.', '🌍',
    '{"type":"unique_cuisines_reviewed","threshold":7,"window_days":90}', 30)
ON CONFLICT (slug) DO NOTHING;
