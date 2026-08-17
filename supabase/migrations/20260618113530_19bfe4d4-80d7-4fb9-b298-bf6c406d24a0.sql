-- Rozszerzenie tabeli profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Username musi być unikalny i pasować do formatu
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 500);

-- Trigger updated_at
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Publiczny odczyt profilu (tylko podstawowe pola — komponowane przez widok lub aplikację)
-- Każdy zalogowany może widzieć profile publiczne; własny zawsze widoczny
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
CREATE POLICY "public profiles readable"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (is_public = TRUE OR auth.uid() = id);

-- Grant na anon (do publicznego profilu /u/$username)
GRANT SELECT ON public.profiles TO anon;

-- Pozwól użytkownikowi wstawić własny profil (na wypadek gdyby trigger nie zadziałał)
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

