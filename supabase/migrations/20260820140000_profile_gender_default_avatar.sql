-- Optional gender at signup ('M'/'K', NULL = "wolę nie podawać"). Purely
-- cosmetic — picks which default avatar (blue/pink) shows before the user
-- uploads their own photo. Never required, never shown to other users as a
-- fact about them beyond the avatar color choice they made themselves.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_valid CHECK (gender IS NULL OR gender IN ('M', 'K'));
