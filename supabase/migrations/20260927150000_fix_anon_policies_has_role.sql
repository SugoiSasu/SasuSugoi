-- NAPRAWA AWARII: strona glowna zwracala 500 dla niezalogowanych.
--
-- Rundy 2 i 3 hardeningu nadaly czterem tabelom polityki SELECT "TO anon,
-- authenticated", ktore w warunku wolaja public.has_role(). Tyle ze rola
-- `anon` nie ma prawa wykonania has_role - odebrano je juz w migracji
-- 20260723203110 i slusznie, bo inaczej kazdy mogl odpytywac o role.
--
-- Skutek: anonimowy odczyt tych tabel konczyl sie bledem 42501
-- "permission denied for function has_role", a nie zwyczajnym odfiltrowaniem
-- wierszy. Strona glowna dociaga place_locations razem z lokalami (jeden
-- select z zagniezdzeniem), wiec padalo CALE zapytanie o lokale, a z nim
-- renderowanie po stronie serwera. Do tego doszly reklamy oraz zdjecia i
-- wpisy lokali - czyli serwis byl rozwalony dla kazdego niezalogowanego,
-- takze dla robotow wyszukiwarek.
--
-- Nie zlapalem tego przy weryfikacji, bo testowalem na zalogowanym koncie:
-- rola `authenticated` ma prawo do has_role i te same polityki dzialaly.
--
-- Rozwiazanie: helper is_admin() z SECURITY DEFINER. Wykonuje sie z
-- uprawnieniami wlasciciela, wiec wolanie has_role w srodku przechodzi, a na
-- zewnatrz oddaje wylacznie informacje o WLASNEJ roli wolajacego - anonim
-- zawsze dostanie false i nie da sie przez to odpytywac o cudze role.
-- Nadanie anonowi prawa wprost do has_role byloby cofnieciem tamtej poprawki.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'super_admin')
     );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ── Cztery polityki przepisane na is_admin() ────────────────────────────────
-- Warunki merytoryczne bez zmian - podmieniona jest wylacznie para wolan
-- has_role na jedno wolanie is_admin().

DROP POLICY IF EXISTS "place_locations read published" ON public.place_locations;
CREATE POLICY "place_locations read published" ON public.place_locations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_locations.place_id AND p.is_published = true)
    OR public.is_admin()
    OR public.is_place_owner(auth.uid(), place_locations.place_id)
  );

DROP POLICY IF EXISTS "place_posts read published" ON public.place_posts;
CREATE POLICY "place_posts read published" ON public.place_posts
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_posts.place_id AND p.is_published = true)
    OR public.is_admin()
    OR public.is_place_owner(auth.uid(), place_posts.place_id)
  );

DROP POLICY IF EXISTS "place_photos read published" ON public.place_photos;
CREATE POLICY "place_photos read published" ON public.place_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_photos.place_id AND p.is_published = true)
    OR public.is_admin()
    OR public.is_place_owner(auth.uid(), place_photos.place_id)
  );

DROP POLICY IF EXISTS "ads read live or admin" ON public.ads;
CREATE POLICY "ads read live or admin" ON public.ads
  FOR SELECT TO anon, authenticated
  USING (
    (
      active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    )
    OR public.is_admin()
  );

INSERT INTO public.admin_changelog (summary) VALUES
  ('Naprawa 500 na stronie glownej: polityki dla anonimow wolaly has_role, do ktorej anon nie ma prawa. Wprowadzony helper is_admin() (SECURITY DEFINER).');
