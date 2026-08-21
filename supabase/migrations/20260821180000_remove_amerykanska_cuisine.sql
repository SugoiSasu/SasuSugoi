-- Liquidate the "Amerykańska" cuisine category globally.
--
-- All 3 places currently tagged "Amerykańska" are burger/BBQ joints in
-- substance (see their own descriptions) and the category already shared
-- its cover art with "Burgery" — reassign them there instead of leaving
-- an orphaned cuisine string once the category row is gone:
--   - The Round               ("Amerykański pub ... amerykańskie klasyki")
--   - Pastrami Summer Barbecue ("BBQ street food ... burgery")
--   - Smaszne Tej              ("Konkretne burgery z charakterem")
--
-- guard_places_owner_columns (see 20260819131000) reverts `cuisine` to OLD
-- for any non-admin acting role, which includes this migration running
-- outside PostgREST's auth context — disable it for the single UPDATE.
ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;

UPDATE public.places
SET cuisine = 'Burgery'
WHERE cuisine = 'Amerykańska';

ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;

-- Strip the now-dead tag from any profile's favorite_cuisines picks.
UPDATE public.profiles
SET favorite_cuisines = array_remove(favorite_cuisines, 'Amerykańska')
WHERE 'Amerykańska' = ANY(favorite_cuisines);

-- Remove the category itself.
DELETE FROM public.cuisines
WHERE name = 'Amerykańska';
