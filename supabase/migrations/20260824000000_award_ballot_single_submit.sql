-- "Warte poŻarcia" voting was per-category, instant-save, changeable any
-- time before the event closes. Mateusz wants a single "submit my ballot"
-- action instead: pick everything, send once, and that account can never
-- touch its votes again for this event.
--
-- award_ballots is the lock: one row per (event, user) marks "this account
-- is done". submit_award_ballot() is the only way to write to award_votes
-- going forward - it upserts every pick and inserts the ballot row in one
-- transaction, so a half-submitted ballot can never happen. Direct INSERT/
-- UPDATE on award_votes is revoked from authenticated - only the
-- SECURITY DEFINER function (which checks the ballot lock itself) can
-- write there now.

CREATE TABLE public.award_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.awards_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT ON public.award_ballots TO authenticated;
GRANT ALL ON public.award_ballots TO service_role;
ALTER TABLE public.award_ballots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ballot" ON public.award_ballots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all ballots" ON public.award_ballots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Voting now only ever happens through this function - drop the old
-- direct-write policies and the grant that let the client INSERT/UPDATE
-- award_votes itself.
DROP POLICY IF EXISTS "users cast own vote" ON public.award_votes;
DROP POLICY IF EXISTS "users change own vote" ON public.award_votes;
REVOKE INSERT, UPDATE ON public.award_votes FROM authenticated;

CREATE OR REPLACE FUNCTION public.submit_award_ballot(_event_id uuid, _picks jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_cuisine_ids uuid[];
  v_pick record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT status, cuisine_ids INTO v_status, v_cuisine_ids
  FROM public.awards_events WHERE id = _event_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'event_not_active';
  END IF;

  IF EXISTS (SELECT 1 FROM public.award_ballots WHERE event_id = _event_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  FOR v_pick IN SELECT * FROM jsonb_to_recordset(_picks) AS x(cuisine_id uuid, place_id uuid) LOOP
    IF v_pick.cuisine_id IS NULL OR v_pick.place_id IS NULL OR NOT (v_pick.cuisine_id = ANY (v_cuisine_ids)) THEN
      RAISE EXCEPTION 'invalid_pick';
    END IF;
    INSERT INTO public.award_votes (event_id, user_id, cuisine_id, place_id)
    VALUES (_event_id, v_uid, v_pick.cuisine_id, v_pick.place_id)
    ON CONFLICT (event_id, user_id, cuisine_id) DO UPDATE SET place_id = EXCLUDED.place_id, updated_at = now();
  END LOOP;

  INSERT INTO public.award_ballots (event_id, user_id) VALUES (_event_id, v_uid);
END $$;

REVOKE ALL ON FUNCTION public.submit_award_ballot(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_award_ballot(uuid, jsonb) TO authenticated;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Głosowanie w "Warte poŻarcia" zmienione na jednorazowe - wybierasz wszystkie kategorie i wysyłasz raz, bez możliwości zmiany.');
