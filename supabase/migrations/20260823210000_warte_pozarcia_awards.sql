-- "Warte poŻarcia" - an annual awards event, one place voted best per cuisine
-- category. Fully hidden until a super_admin flips an event to 'active' (no
-- cron/scheduling - deliberately manual, "odpalany na prośbę"). Nav links and
-- the public page both gate on there being an active/closed event to show.

CREATE TABLE public.awards_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  cuisine_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE public.award_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.awards_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuisine_id uuid NOT NULL REFERENCES public.cuisines(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, cuisine_id)
);
CREATE INDEX award_votes_event_cuisine_idx ON public.award_votes(event_id, cuisine_id);

CREATE TABLE public.award_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.awards_events(id) ON DELETE CASCADE,
  cuisine_id uuid NOT NULL REFERENCES public.cuisines(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  vote_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, cuisine_id)
);
CREATE INDEX award_winners_place_idx ON public.award_winners(place_id);

GRANT SELECT ON public.awards_events TO anon, authenticated;
GRANT ALL ON public.awards_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.award_votes TO authenticated;
GRANT ALL ON public.award_votes TO service_role;
GRANT SELECT ON public.award_winners TO anon, authenticated;
GRANT ALL ON public.award_winners TO service_role;

ALTER TABLE public.awards_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_winners ENABLE ROW LEVEL SECURITY;

-- awards_events: public only sees events once live or wrapped up; admins see everything.
CREATE POLICY "public reads active or closed events" ON public.awards_events
  FOR SELECT USING (status IN ('active', 'closed'));
CREATE POLICY "admins read all events" ON public.awards_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin manages events" ON public.awards_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- award_votes: results stay secret until close - each voter only sees their own
-- ballot (so the UI can show "you already voted for X"), admins see everything
-- to monitor live counts. Casting/changing a vote requires the event to still
-- be active and the cuisine to actually be part of it.
CREATE POLICY "users read own votes" ON public.award_votes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all votes" ON public.award_votes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "users cast own vote" ON public.award_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.awards_events e
      WHERE e.id = event_id AND e.status = 'active' AND cuisine_id = ANY (e.cuisine_ids)
    )
  );
CREATE POLICY "users change own vote" ON public.award_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.awards_events e
      WHERE e.id = event_id AND e.status = 'active' AND cuisine_id = ANY (e.cuisine_ids)
    )
  );

-- award_winners: public once frozen (badges on place profiles, results page).
CREATE POLICY "public reads winners" ON public.award_winners
  FOR SELECT USING (true);
CREATE POLICY "super_admin manages winners" ON public.award_winners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tallies votes per cuisine, freezes the top place into award_winners, closes
-- the event. SECURITY DEFINER (bypasses RLS to read every ballot) so the
-- super_admin check happens inside the function, not via the grant.
CREATE OR REPLACE FUNCTION public.close_awards_event(_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_cuisine_ids uuid[];
  v_cuisine_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT status, cuisine_ids INTO v_status, v_cuisine_ids
  FROM public.awards_events WHERE id = _event_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Wydarzenie nie istnieje';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Wydarzenie nie jest aktywne';
  END IF;

  FOREACH v_cuisine_id IN ARRAY v_cuisine_ids LOOP
    INSERT INTO public.award_winners (event_id, cuisine_id, place_id, vote_count)
    SELECT _event_id, v_cuisine_id, place_id, count(*) AS votes
    FROM public.award_votes
    WHERE event_id = _event_id AND cuisine_id = v_cuisine_id
    GROUP BY place_id
    ORDER BY votes DESC, place_id ASC
    LIMIT 1
    ON CONFLICT (event_id, cuisine_id) DO NOTHING;
  END LOOP;

  UPDATE public.awards_events SET status = 'closed', closed_at = now() WHERE id = _event_id;
END $$;

REVOKE ALL ON FUNCTION public.close_awards_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_awards_event(uuid) TO authenticated;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Dodano system dorocznych nagród "Warte poŻarcia" - głosowanie na najlepszy lokal w każdej kategorii kuchni, odpalane ręcznie z panelu admina.');
