-- Publikacja "The Round" - decyzja Mateusza 2026-09-28, po przejrzeniu karty.
--
-- Jedyny szkic, ktory spelnial caly standard publikacji (ma wszystko, co maja
-- opublikowane lokale, lacznie z logo).
--
-- Przy okazji poprawka godzin: wtorek mial 18:00-18:00. Kod liczy
-- "zamkniecie <= otwarcie" jako otwarte przez polnoc, wiec apka pokazywalaby
-- lokal jako otwarty cala dobe, od wtorku 18:00 do srody 18:00. Mateusz:
-- we wtorek zamkniete. Zamkniety dzien = brak klucza (tak zapisanych jest 19
-- dni w bazie), stad `- 'tue'`. Jedyny taki wpis open==close w calej bazie.
--
-- is_published jest pilnowane przez places_guard_owner_columns (cofa po cichu
-- zmiany spoza sesji admina), wiec trigger wylaczony na czas tej transakcji.
-- Warunki w WHERE sprawdzaja dokladnie stan pokazany Mateuszowi - gdyby ktos
-- zdazyl cos zmienic recznie, migracja nic nie ruszy.

ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;

UPDATE public.places
SET opening_hours = opening_hours - 'tue',
    is_published = true
WHERE id = 'c22388f0-86f6-4b0d-aca1-dc628ab3e9d2'
  AND name = 'The Round'
  AND is_published = false
  AND opening_hours->'tue'->>'open' = '18:00'
  AND opening_hours->'tue'->>'close' = '18:00';

ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Opublikowano The Round (Bukowska 3/9). Wtorek oznaczony jako zamkniety - byl wpis 18:00-18:00.');
