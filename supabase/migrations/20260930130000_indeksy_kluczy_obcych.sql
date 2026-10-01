-- Indeksy na kluczach obcych bez indeksu (jednokolumnowych). Tabele sa dzis
-- male, ale: (1) usuniecie rodzica (lokal, uzytkownik) skanuje cale tabele
-- potomne bez indeksu, (2) filtrowanie po tych kolumnach (RLS, "moje X") bedzie
-- sie robic coraz wolniejsze z liczba uzytkownikow. Idempotentne.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS kolumna
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      left('idx_fk_' || replace(r.tabela, 'public.', '') || '_' || r.kolumna, 63), r.tabela, r.kolumna);
  END LOOP;
END $$;
