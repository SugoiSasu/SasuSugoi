-- GEMÜSE SPOT's cover_image_url was overwritten at some point with the
-- generic "Kebaby" category pattern illustration (public/brand/
-- po_zeramy-kebab-pattern.jpg) instead of a real photo of the place —
-- confirmed by byte-comparing the stored file against the category art.
-- The place does have a legit avatar_url (its real logo), so clearing the
-- bogus cover lets the homepage card fall back to that logo instead of
-- silently showing generic filler art as if it were a real photo.
ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;

UPDATE public.places
SET cover_image_url = NULL
WHERE id = 'd0eda94d-1365-4a70-bd54-9aa68f6f13eb'
  AND cover_image_url LIKE '%/place-photos/d0eda94d-1365-4a70-bd54-9aa68f6f13eb/cover.webp%';

ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;
