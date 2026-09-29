-- Ogolny rodzaj trofeum "inna_nagroda" (White Star, Gault&Millau itp.):
-- dopisywany recznie z wlasnym opisem. AI go nie szuka.
ALTER TABLE public.place_trophies DROP CONSTRAINT IF EXISTS place_trophies_kind_check;
ALTER TABLE public.place_trophies ADD CONSTRAINT place_trophies_kind_check
  CHECK (kind IN ('michelin_star', 'michelin_bib', 'michelin_recommended', 'warte_pozarcia', 'inna_nagroda'));
ALTER TABLE public.place_trophies ADD CONSTRAINT place_trophies_other_label
  CHECK (kind <> 'inna_nagroda' OR (label IS NOT NULL AND btrim(label) <> ''));
