-- Tinder-style swipe deck ("/karty"): swiping left records a cooldown so
-- the same place doesn't reappear in the deck for 5 days, without being a
-- permanent "never show again" — matches the product decision to keep this
-- lightweight rather than a full dismissal system.

CREATE TABLE public.place_swipe_skips (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

GRANT SELECT, INSERT, UPDATE ON public.place_swipe_skips TO authenticated;
GRANT ALL ON public.place_swipe_skips TO service_role;

ALTER TABLE public.place_swipe_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swipe_skips owner read" ON public.place_swipe_skips FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "swipe_skips owner insert" ON public.place_swipe_skips FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "swipe_skips owner update" ON public.place_swipe_skips FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_place_swipe_skips_user ON public.place_swipe_skips(user_id);
