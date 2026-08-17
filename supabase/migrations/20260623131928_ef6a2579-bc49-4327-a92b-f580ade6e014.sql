-- Add points_total to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points_total integer NOT NULL DEFAULT 0;

-- 1. reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (body IS NULL OR length(body) <= 2000),
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews owner insert" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews owner update" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews owner delete" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE INDEX reviews_place_id_idx ON public.reviews(place_id);
CREATE INDEX reviews_user_id_idx ON public.reviews(user_id);

CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. points_rules (configurable)
CREATE TABLE public.points_rules (
  event_key text PRIMARY KEY,
  points integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.points_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.points_rules TO authenticated;
GRANT ALL ON public.points_rules TO service_role;

ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_rules public read" ON public.points_rules FOR SELECT USING (true);
CREATE POLICY "points_rules admin write" ON public.points_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('review_created',       10, 'Za dodanie recenzji (raz na lokal)'),
  ('review_with_photo',     5, 'Bonus za załączenie zdjęcia do recenzji'),
  ('first_visit_new_place',20, 'Bonus za pierwszą recenzję w nowym lokalu')
ON CONFLICT DO NOTHING;

-- 3. points_transactions (audit + reversible)
CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  points integer NOT NULL,
  ref_type text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_tx owner read" ON public.points_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE INDEX points_tx_user_idx ON public.points_transactions(user_id);

-- 4. helper: award points (security definer; called from triggers)
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid, _event_key text, _ref_type text, _ref_id uuid, _multiplier int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pts int;
BEGIN
  SELECT points INTO v_pts FROM public.points_rules WHERE event_key = _event_key AND enabled = true;
  IF v_pts IS NULL THEN RETURN; END IF;
  v_pts := v_pts * _multiplier;
  INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
  VALUES (_user_id, _event_key, v_pts, _ref_type, _ref_id);
  UPDATE public.profiles SET points_total = points_total + v_pts WHERE id = _user_id;
END;
$$;

-- 5. triggers on reviews
CREATE OR REPLACE FUNCTION public.reviews_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first_visit boolean;
BEGIN
  PERFORM public.award_points(NEW.user_id, 'review_created', 'review', NEW.id);
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
    PERFORM public.award_points(NEW.user_id, 'review_with_photo', 'review', NEW.id);
  END IF;
  -- first visit = no prior review by this user for this place (we just inserted, so check =1)
  SELECT (count(*) = 1) INTO v_first_visit
  FROM public.reviews WHERE user_id = NEW.user_id AND place_id = NEW.place_id;
  IF v_first_visit THEN
    PERFORM public.award_points(NEW.user_id, 'first_visit_new_place', 'review', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_reverse_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sum int;
BEGIN
  SELECT COALESCE(sum(points),0) INTO v_sum
  FROM public.points_transactions
  WHERE ref_type = 'review' AND ref_id = OLD.id;

  IF v_sum <> 0 THEN
    INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
    VALUES (OLD.user_id, 'review_deleted', -v_sum, 'review', OLD.id);
    UPDATE public.profiles SET points_total = points_total - v_sum WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER reviews_award_after_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_award_on_insert();

CREATE TRIGGER reviews_reverse_after_delete
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_reverse_on_delete();

