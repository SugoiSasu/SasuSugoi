-- Otwórz publiczny odczyt wszystkich profili — każdy może zobaczyć każdy profil użytkownika
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "own profile read" ON public.profiles;

CREATE POLICY "anyone can read profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.profiles TO anon;

