-- 1. Funkcje admina od lokali bez klucza serwisowego.
--
-- Na produkcji (Vercel) nie ma SUPABASE_SERVICE_ROLE_KEY - "Szukaj" w
-- edytorze lokalu konczyl sie bledem "Missing Supabase environment
-- variable(s)". Funkcje dzialaja teraz na sesji zalogowanego admina, wiec
-- admin musi moc zapisac propozycje sam (dotad tylko czytal i usuwal).
CREATE POLICY "place_enrichment admin insert" ON public.place_enrichment
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "place_enrichment admin update" ON public.place_enrichment
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE ON public.place_enrichment TO authenticated;

-- 2. Menu jako PDF (Mateusz 2026-09-28: "nie mozna wrzucic pdf jako menu
--    i z niego zczytac z ai"). Bucket przyjmowal tylko jpeg/png/webp do 5 MB;
--    karty menu w PDF bywaja wieksze. Wgrywac moga tylko admini i wlasciciele
--    (polityki storage bez zmian).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 10485760
WHERE id = 'place-photos';
