-- Propozycje danych lokalu znalezione w internecie (AI + oficjalna strona).
--
-- Jedna propozycja na lokal. Szukanie kosztuje (ok. 0,5 USD i minuta na
-- lokal), wiec wynik jest zapisywany: admin moze przeszukac wszystkie szkice
-- hurtem i przegladac propozycje pozniej, po kolei, bez ponownego placenia.
-- Nic stad nie trafia do places samo - admin zatwierdza pole po polu w
-- edytorze lokalu.
--
-- Zapis tylko z funkcji serwerowej (service role, po sprawdzeniu roli admina);
-- przegladarka admina czyta i usuwa.

CREATE TABLE IF NOT EXISTS public.place_enrichment (
  place_id uuid PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('szukam', 'gotowe', 'blad')),
  propozycja jsonb,
  blad text,
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_enrichment admin read" ON public.place_enrichment
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "place_enrichment admin delete" ON public.place_enrichment
  FOR DELETE TO authenticated USING (public.is_admin());

REVOKE ALL ON public.place_enrichment FROM anon, authenticated;
GRANT SELECT, DELETE ON public.place_enrichment TO authenticated;
