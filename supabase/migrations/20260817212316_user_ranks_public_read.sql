-- user_ranks was readable only by `authenticated` (per the current live policy
-- "user_ranks authenticated read"), inconsistent with the rest of a public
-- profile (profiles.points_total, achievements, stats are all anon-readable).
-- A visitor's rank badge (e.g. "Head Admin") should show on public profiles
-- the same way points/stats already do.
GRANT SELECT ON public.user_ranks TO anon;

CREATE POLICY "user_ranks public read" ON public.user_ranks
  FOR SELECT TO anon USING (true);
