-- Migracja 20260820120000_friends_only_privacy_fix zamknęła place_visits i
-- place_favorites regułą "właściciel / znajomy / profil publiczny", ale
-- place_follows została wtedy pominięta i do dziś ma SELECT USING (true)
-- z GRANT-em dla anon. Bez żadnego konta dało się pobrać całe mapowanie
-- user_id -> place_id (z datami), także dla osób z wyłączonym "Profil
-- publiczny", którym UI obiecuje "Tylko Twoi znajomi widzą wall i listy
-- miejsc". To ta sama klasa danych co ulubione, więc ta sama reguła.
--
-- W chwili pisania tabela jest pusta, więc nic jeszcze nie wyciekło - poprawka
-- zamyka drzwi, zanim ktokolwiek zacznie obserwować lokale.

-- Liczniki na stronach lokali potrzebują sumy po WSZYSTKICH obserwujących.
-- Liczy je funkcja SECURITY DEFINER (RLS jej nie dotyczy), więc zawężenie
-- polityki niczego nie psuje. Definiujemy ją tu ponownie (idempotentnie), bo
-- jest też w 20260915130000_place_counts_aggregates.sql - gdyby ta migracja
-- została zaaplikowana wcześniej, kliencki fallback liczyłby tylko wiersze
-- widoczne dla oglądającego i zaniżał liczniki.
CREATE OR REPLACE FUNCTION public.place_follow_counts()
RETURNS TABLE(place_id uuid, count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT place_id, count(*)::int
  FROM public.place_follows
  GROUP BY place_id;
$$;

GRANT EXECUTE ON FUNCTION public.place_follow_counts() TO anon, authenticated;

DROP POLICY IF EXISTS "place_follows public read" ON public.place_follows;
DROP POLICY IF EXISTS "place_follows read own public or friend" ON public.place_follows;

CREATE POLICY "place_follows read own public or friend" ON public.place_follows
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_friend_with(user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = place_follows.user_id AND p.is_public = true
    )
  );
