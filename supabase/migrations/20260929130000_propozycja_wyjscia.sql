-- Karty: "Match ze znajomymi" -> "Zaproponuj wspólne wyjście".
-- Aplikacja nie ma wiadomości prywatnych, więc propozycja to powiadomienie
-- (dzwonek) dla znajomych, którzy sami oznaczyli ten lokal jako "chcę odwiedzić".
-- Adresatów wybiera serwer, nie klient - nie da się tą funkcją wysłać
-- powiadomienia komukolwiek poza własnym znajomym z tym lokalem na liście.

-- Ustawienie powiadomień: nowy typ domyślnie włączony (brak klucza = włączone,
-- patrz public.notify).

CREATE OR REPLACE FUNCTION public.propose_outing(_place_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_name text;
  v_place text;
  v_slug text;
  v_friend uuid;
  v_sent integer := 0;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany' USING ERRCODE = '42501';
  END IF;

  SELECT name, slug INTO v_place, v_slug
  FROM public.places
  WHERE id = _place_id AND is_published IS NOT FALSE;
  IF v_place IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego lokalu' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Znajomy')
  INTO v_name FROM public.profiles WHERE id = v_me;

  FOR v_friend IN
    SELECT DISTINCT CASE WHEN f.requester_id = v_me THEN f.addressee_id ELSE f.requester_id END
    FROM public.friendships f
    JOIN public.place_visits pv
      ON pv.place_id = _place_id
     AND pv.status = 'want'
     AND pv.user_id = CASE WHEN f.requester_id = v_me THEN f.addressee_id ELSE f.requester_id END
    WHERE f.status = 'accepted'
      AND (f.requester_id = v_me OR f.addressee_id = v_me)
  LOOP
    -- Jedna propozycja na parę (ja, znajomy, lokal) w ciągu 7 dni - żeby
    -- ponowne kliknięcie nie zasypywało dzwonka. Nadawca jest w ref_type.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_friend
        AND n.type = 'outing'
        AND n.ref_type = 'outing:' || v_me::text
        AND n.ref_id = _place_id
        AND n.created_at > now() - interval '7 days'
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.notify(
      v_friend, 'outing', 'Wspólne wyjście?',
      v_name || ' proponuje wypad do: ' || v_place,
      '/k/' || v_slug, 'outing:' || v_me::text, _place_id
    );
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_outing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_outing(uuid) TO authenticated;

-- Klucz w domyślnych ustawieniach profilu (istniejące wiersze bez klucza
-- traktujemy jako "włączone", więc bez przepisywania danych).
ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT jsonb_build_object(
    'friend_request', true,
    'friend_accepted', true,
    'place_post', true,
    'achievement', true,
    'outing', true
  );
