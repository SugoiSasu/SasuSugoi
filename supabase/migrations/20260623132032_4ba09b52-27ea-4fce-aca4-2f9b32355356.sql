CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]{2,40}$'),
  name text NOT NULL,
  description text,
  icon_url text,
  criteria jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.achievements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "achievements admin write" ON public.achievements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE TRIGGER achievements_set_updated_at BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT ALL ON public.user_achievements TO service_role;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements public read" ON public.user_achievements FOR SELECT USING (true);

CREATE INDEX user_achievements_user_idx ON public.user_achievements(user_id);

-- Seed a few defaults
INSERT INTO public.achievements (slug, name, description, criteria, sort_order) VALUES
  ('first_bite',      'Pierwszy gryz',       'Dodaj pierwszą recenzję',                  '{"type":"reviews_count","threshold":1}'::jsonb, 1),
  ('local_explorer',  'Lokalny zwiadowca',   'Odwiedź 5 różnych lokali',                 '{"type":"unique_places","threshold":5}'::jsonb, 2),
  ('food_critic',     'Krytyk kulinarny',    'Dodaj 10 recenzji',                        '{"type":"reviews_count","threshold":10}'::jsonb, 3),
  ('hundred_club',    'Klub Setki',          'Zdobądź 100 punktów PoŻarcia',             '{"type":"points_total","threshold":100}'::jsonb, 4),
  ('social_butterfly','Społeczny żarłok',    'Miej 5 znajomych',                         '{"type":"friends_count","threshold":5}'::jsonb, 5)
ON CONFLICT DO NOTHING;

-- Engine: check_achievements(user_id) — INVOKER so callable from triggers + RPC
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
BEGIN
  FOR r IN SELECT id, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := r.criteria->>'type';
    v_threshold := (r.criteria->>'threshold')::int;
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, r.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;

-- Hook check_achievements into the existing review trigger
CREATE OR REPLACE FUNCTION public.reviews_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first_visit boolean;
BEGIN
  PERFORM public.award_points(NEW.user_id, 'review_created', 'review', NEW.id);
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
    PERFORM public.award_points(NEW.user_id, 'review_with_photo', 'review', NEW.id);
  END IF;
  SELECT (count(*) = 1) INTO v_first_visit
  FROM public.reviews WHERE user_id = NEW.user_id AND place_id = NEW.place_id;
  IF v_first_visit THEN
    PERFORM public.award_points(NEW.user_id, 'first_visit_new_place', 'review', NEW.id);
  END IF;
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;

-- Trigger on friendships acceptance: recheck both users' achievements
CREATE OR REPLACE FUNCTION public.friendships_check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.check_achievements(NEW.requester_id);
    PERFORM public.check_achievements(NEW.addressee_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.friendships_check_achievements() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER friendships_achievements_after_update
  AFTER UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_check_achievements();

