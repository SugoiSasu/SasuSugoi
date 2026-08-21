-- One-off data fix: "The Round"'s description was corrupted by a botched
-- seed script - it ended up storing literal leftover SQL (an "ON CONFLICT
-- DO NOTHING; INSERT INTO ... VALUES (" fragment) spliced between two
-- otherwise-legit sentences of description text. Reconstruct the intended
-- text by dropping the SQL fragment and joining the two sentences.
--
-- The guard_places_owner_columns trigger (see 20260819131000) reverts
-- `description` to OLD whenever the acting role isn't has_role(auth.uid(),
-- 'admin') - which includes this migration running outside PostgREST's
-- auth context - so it's disabled for the duration of this single UPDATE.
ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;

UPDATE public.places
SET description = 'Amerykański pub w samym centrum Poznania. Sportowe emocje, amerykańskie klasyki i piwo w kuflu.'
WHERE id = 'c22388f0-86f6-4b0d-aca1-dc628ab3e9d2';

ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;
