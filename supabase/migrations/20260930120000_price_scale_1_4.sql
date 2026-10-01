-- Jedna skala cen 1-4 ("$".."$$$$", wyswietlana jako "zl zl ..."):
-- piaty poziom schodzi na 4, dwa teksty w zlotowkach przeliczone wg progow
-- (1 <25 zl, 2 25-40, 3 40-60, 4 >=60; srodek przedzialu).
-- places_guard_owner_columns po cichu cofa price_range, gdy zmienia go ktos
-- bez roli admina (migracja nie ma auth.uid()), wiec na czas zmiany go wylaczamy.
ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;
UPDATE public.places SET price_range = '$$$$' WHERE price_range = '$$$$$';
UPDATE public.places SET price_range = '$$'  WHERE price_range = '20-50zł';
UPDATE public.places SET price_range = '$$$$' WHERE price_range = '20-200zł';
ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_price_range_scale;
ALTER TABLE public.places ADD CONSTRAINT places_price_range_scale
  CHECK (price_range IS NULL OR price_range ~ '^\${0,4}$');
