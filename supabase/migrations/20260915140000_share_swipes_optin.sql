-- PRODUCT.md opisuje Karty jako coś, co znajomi obserwują ("friends watching
-- what they react to"), ale decyzje ze swipe'a trafiały wyłącznie na prywatną
-- listę "Chcę odwiedzić". Ten opt-in domyka tę obietnicę, nie zaskakując
-- nikogo: domyślnie wyłączony, włączany świadomie w Ustawieniach.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_swipes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.share_swipes IS
  'Opt-in: czy znajomi widzą na Pożeralni, że użytkownik dodał lokal do "Chcę odwiedzić". Domyślnie false.';

-- Zwraca wizyty o statusie "want" wyłącznie tych użytkowników, którzy wyrazili
-- zgodę. Filtr siedzi w bazie, nie w kliencie: odfiltrowanie w JS oznaczałoby,
-- że dane osób bez zgody i tak poszły po sieci - to nie byłaby prywatność,
-- tylko ukrycie w UI.
--
-- Celowo NIE zwraca odrzuceń (place_swipe_skips). Informacja "ktoś odrzucił
-- ten lokal" jest z natury negatywna i nie ma powodu, żeby kiedykolwiek
-- opuszczała konto użytkownika.
CREATE OR REPLACE FUNCTION public.shared_friend_wants(_user_ids uuid[], _since timestamptz)
RETURNS TABLE(id uuid, user_id uuid, place_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pv.id, pv.user_id, pv.place_id, pv.created_at
  FROM public.place_visits pv
  JOIN public.profiles p ON p.id = pv.user_id
  WHERE pv.user_id = ANY(_user_ids)
    AND pv.status = 'want'
    AND pv.created_at >= _since
    AND p.share_swipes = true
  ORDER BY pv.created_at DESC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.shared_friend_wants(uuid[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_friend_wants(uuid[], timestamptz) TO authenticated;
