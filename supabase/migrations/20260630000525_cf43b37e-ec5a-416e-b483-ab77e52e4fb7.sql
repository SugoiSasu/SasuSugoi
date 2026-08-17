ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS promo_label text,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.places
  ADD CONSTRAINT places_promo_label_len CHECK (promo_label IS NULL OR char_length(promo_label) <= 100);

