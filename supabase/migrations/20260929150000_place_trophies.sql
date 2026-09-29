-- Trofea lokali: gwiazdki Michelin, Bib Gourmand, Wyroznienie/Rekomendacja
-- Michelin oraz reczne wpisy "Warte poZarcia". Wygrane z NASZEGO glosowania
-- (award_winners) dochodza automatycznie przez place_trophies_for(), bez
-- kopiowania danych.
--
-- status = 'propozycja': wpis podsunal AI i czeka na zatwierdzenie admina.
-- Publicznie widac tylko 'zatwierdzone' (nieprawdziwa gwiazdka Michelin nie moze
-- wisiec na profilu, dopoki czlowiek jej nie sprawdzi).

CREATE TABLE IF NOT EXISTS public.place_trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('michelin_star', 'michelin_bib', 'michelin_recommended', 'warte_pozarcia')),
  tier smallint CHECK (tier BETWEEN 1 AND 3),
  year integer NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  label text CHECK (label IS NULL OR char_length(label) <= 120),
  source_url text CHECK (source_url IS NULL OR char_length(source_url) <= 500),
  status text NOT NULL DEFAULT 'zatwierdzone' CHECK (status IN ('zatwierdzone', 'propozycja')),
  proposed_by_ai boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_trophies_star_tier CHECK (kind <> 'michelin_star' OR tier IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS place_trophies_unique
  ON public.place_trophies (place_id, kind, year, coalesce(label, ''));
CREATE INDEX IF NOT EXISTS place_trophies_place_idx ON public.place_trophies (place_id);

ALTER TABLE public.place_trophies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.place_trophies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.place_trophies TO authenticated;
GRANT ALL ON public.place_trophies TO service_role;

CREATE POLICY "trofea: publiczne zatwierdzone opublikowanych lokali" ON public.place_trophies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'zatwierdzone'
    AND EXISTS (SELECT 1 FROM public.places p WHERE p.id = place_trophies.place_id AND p.is_published = true)
  );
CREATE POLICY "trofea: admin czyta wszystko" ON public.place_trophies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "trofea: admin dodaje" ON public.place_trophies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "trofea: admin zmienia" ON public.place_trophies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "trofea: admin usuwa" ON public.place_trophies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Zatwierdzone trofea (reczne + wygrane w naszym glosowaniu). INVOKER: RLS
-- tabel (opublikowane lokale dla gosci) dziala jak zwykle.
CREATE OR REPLACE FUNCTION public.place_trophies_for(_place_id uuid DEFAULT NULL)
RETURNS TABLE (place_id uuid, kind text, tier smallint, year integer, label text, source_url text, origin text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.place_id, t.kind, t.tier, t.year, t.label, t.source_url, 'reczne'::text
  FROM public.place_trophies t
  WHERE t.status = 'zatwierdzone' AND (_place_id IS NULL OR t.place_id = _place_id)
  UNION ALL
  SELECT w.place_id, 'warte_pozarcia'::text, NULL::smallint,
         extract(year FROM coalesce(e.closed_at, e.created_at))::integer,
         c.name, NULL::text, 'glosowanie'::text
  FROM public.award_winners w
  JOIN public.awards_events e ON e.id = w.event_id AND e.status = 'closed'
  JOIN public.cuisines c ON c.id = w.cuisine_id
  JOIN public.places p ON p.id = w.place_id
  WHERE (_place_id IS NULL OR w.place_id = _place_id)
    AND (p.is_published = true
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
$$;
REVOKE ALL ON FUNCTION public.place_trophies_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_trophies_for(uuid) TO anon, authenticated;
