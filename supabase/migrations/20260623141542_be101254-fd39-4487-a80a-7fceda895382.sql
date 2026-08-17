ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS menu_url text,
  ADD COLUMN IF NOT EXISTS menu_image_url text;

