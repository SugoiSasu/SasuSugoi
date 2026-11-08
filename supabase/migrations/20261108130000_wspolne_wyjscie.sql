-- Wspolne wyjscie: host wybiera do 5 znajomych i talie 2-8 lokali, wszyscy glosuja "tak/nie" na te same
-- lokale, wygrywa najwiecej "tak". Sesja otwarta 24 h.
--
-- Zasady bezpieczenstwa:
--  * zapisy WYLACZNIE przez funkcje SECURITY DEFINER (zadnych polityk INSERT/UPDATE/DELETE),
--  * zapraszac mozna tylko zaakceptowanych znajomych (sprawdza serwer, nie klient),
--  * cudzych glosow nikt nie widzi - tylko zliczenia, i to dopiero po oddaniu wlasnych glosow (albo po zamknieciu),
--    zeby wynik nie sugerowal decyzji,
--  * anon nie ma dostepu do niczego.

CREATE TABLE public.outing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  CONSTRAINT outing_places_count CHECK (cardinality(place_ids) BETWEEN 2 AND 8)
);

CREATE TABLE public.outing_members (
  session_id uuid NOT NULL REFERENCES public.outing_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX outing_members_user_idx ON public.outing_members (user_id);

CREATE TABLE public.outing_votes (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  place_id uuid NOT NULL,
  vote boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id, place_id),
  FOREIGN KEY (session_id, user_id) REFERENCES public.outing_members(session_id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.outing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outing_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outing_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.outing_sessions, public.outing_members, public.outing_votes FROM anon, authenticated;
GRANT SELECT ON public.outing_sessions, public.outing_members, public.outing_votes TO authenticated;

-- Pomocnik: czy zalogowany jest uczestnikiem. SECURITY DEFINER, zeby polityka na outing_members nie odwolywala
-- sie rekurencyjnie do samej siebie.
CREATE OR REPLACE FUNCTION public.is_outing_member(_session uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outing_members WHERE session_id = _session AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_outing_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_outing_member(uuid) TO authenticated;

CREATE POLICY "outing sessions: uczestnik czyta" ON public.outing_sessions
  FOR SELECT TO authenticated USING (public.is_outing_member(id));
CREATE POLICY "outing members: uczestnik czyta" ON public.outing_members
  FOR SELECT TO authenticated USING (public.is_outing_member(session_id));
-- Glosy: kazdy widzi tylko wlasne (zliczenia ogolne daje funkcja outing_results).
CREATE POLICY "outing votes: wlasne" ON public.outing_votes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Utworzenie sesji
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_outing(_friend_ids uuid[], _place_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_friends uuid[];
  v_places uuid[];
  v_id uuid;
  v_name text;
  v_friend uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_friends FROM unnest(COALESCE(_friend_ids, '{}')) x WHERE x <> v_me;
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_places FROM unnest(COALESCE(_place_ids, '{}')) x;

  IF cardinality(v_friends) < 1 OR cardinality(v_friends) > 5 THEN
    RAISE EXCEPTION 'Wybierz od 1 do 5 znajomych' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(v_places) < 2 OR cardinality(v_places) > 8 THEN
    RAISE EXCEPTION 'Talia musi mieć od 2 do 8 lokali' USING ERRCODE = 'P0001';
  END IF;

  -- Tylko zaakceptowani znajomi.
  IF (
    SELECT count(*) FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = v_me AND f.addressee_id = ANY (v_friends))
        OR (f.addressee_id = v_me AND f.requester_id = ANY (v_friends)))
  ) <> cardinality(v_friends) THEN
    RAISE EXCEPTION 'Możesz zapraszać tylko znajomych' USING ERRCODE = '42501';
  END IF;

  -- Czesc profili (konta po migracji z Lovable) nie ma konta logowania - taki znajomy nigdy by nie zaglosowal.
  IF (SELECT count(*) FROM auth.users WHERE id = ANY (v_friends)) <> cardinality(v_friends) THEN
    RAISE EXCEPTION 'Ten znajomy nie ma jeszcze aktywnego konta' USING ERRCODE = 'P0001';
  END IF;

  -- Tylko opublikowane lokale.
  IF (
    SELECT count(*) FROM public.places WHERE id = ANY (v_places) AND is_published IS NOT FALSE
  ) <> cardinality(v_places) THEN
    RAISE EXCEPTION 'Nie ma takiego lokalu' USING ERRCODE = 'P0002';
  END IF;

  -- Ochrona przed zasypywaniem znajomych zaproszeniami.
  IF (
    SELECT count(*) FROM public.outing_sessions WHERE host_id = v_me AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Za dużo wspólnych wyjść w krótkim czasie. Spróbuj za chwilę.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.outing_sessions (host_id, place_ids) VALUES (v_me, v_places) RETURNING id INTO v_id;
  INSERT INTO public.outing_members (session_id, user_id) VALUES (v_id, v_me);
  INSERT INTO public.outing_members (session_id, user_id) SELECT v_id, unnest(v_friends);

  SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Znajomy')
  INTO v_name FROM public.profiles WHERE id = v_me;

  FOREACH v_friend IN ARRAY v_friends LOOP
    PERFORM public.notify(
      v_friend, 'outing', 'Wspólne wyjście!',
      v_name || ' zaprasza Cię do wspólnego wyboru lokalu - zagłosuj w ciągu 24 godzin.',
      '/wyjscie/' || v_id, 'outing_session:' || v_me::text, v_id
    );
  END LOOP;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_outing(uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_outing(uuid[], uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Stan sesji dla uczestnika (bez cudzych glosow: tylko ile kto juz oddal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outing_get(_session uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  r public.outing_sessions%ROWTYPE;
BEGIN
  IF v_me IS NULL OR NOT public.is_outing_member(_session) THEN
    RAISE EXCEPTION 'Nie masz dostępu do tego wyjścia' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.outing_sessions WHERE id = _session;

  RETURN jsonb_build_object(
    'id', r.id,
    'host_id', r.host_id,
    'place_ids', to_jsonb(r.place_ids),
    'status', CASE WHEN r.status = 'open' AND r.expires_at <= now() THEN 'closed' ELSE r.status END,
    'expires_at', r.expires_at,
    'my_votes', COALESCE((
      SELECT jsonb_object_agg(v.place_id::text, v.vote)
      FROM public.outing_votes v WHERE v.session_id = r.id AND v.user_id = v_me
    ), '{}'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'is_host', p.id = r.host_id,
        'votes_done', (SELECT count(*) FROM public.outing_votes v WHERE v.session_id = r.id AND v.user_id = p.id)
      ) ORDER BY (p.id = r.host_id) DESC, p.display_name)
      FROM public.outing_members m JOIN public.profiles p ON p.id = m.user_id
      WHERE m.session_id = r.id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.outing_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outing_get(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Glos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outing_vote(_session uuid, _place uuid, _vote boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  r public.outing_sessions%ROWTYPE;
BEGIN
  IF v_me IS NULL OR NOT public.is_outing_member(_session) THEN
    RAISE EXCEPTION 'Nie masz dostępu do tego wyjścia' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.outing_sessions WHERE id = _session;
  IF r.status <> 'open' OR r.expires_at <= now() THEN
    RAISE EXCEPTION 'To wyjście jest już zamknięte' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (_place = ANY (r.place_ids)) THEN
    RAISE EXCEPTION 'Tego lokalu nie ma w tym wyjściu' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.outing_votes (session_id, user_id, place_id, vote)
  VALUES (_session, v_me, _place, _vote)
  ON CONFLICT (session_id, user_id, place_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.outing_vote(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outing_vote(uuid, uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Wynik: zliczenia, dopiero po oddaniu wlasnych glosow (albo po zamknieciu)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outing_results(_session uuid)
RETURNS TABLE (place_id uuid, yes_count integer, no_count integer, members_total integer, ideal boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  r public.outing_sessions%ROWTYPE;
  v_closed boolean;
  v_members integer;
BEGIN
  IF v_me IS NULL OR NOT public.is_outing_member(_session) THEN
    RAISE EXCEPTION 'Nie masz dostępu do tego wyjścia' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.outing_sessions WHERE id = _session;
  v_closed := r.status <> 'open' OR r.expires_at <= now();

  IF NOT v_closed AND (
    SELECT count(*) FROM public.outing_votes v WHERE v.session_id = _session AND v.user_id = v_me
  ) < cardinality(r.place_ids) THEN
    RAISE EXCEPTION 'Najpierw zagłosuj na wszystkie lokale' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_members FROM public.outing_members WHERE session_id = _session;

  RETURN QUERY
  SELECT pid,
         COALESCE(c.yes, 0)::integer,
         COALESCE(c.no, 0)::integer,
         v_members,
         (COALESCE(c.yes, 0) = v_members AND v_members > 1)
  FROM unnest(r.place_ids) AS pid
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE v.vote) AS yes, count(*) FILTER (WHERE NOT v.vote) AS no
    FROM public.outing_votes v WHERE v.session_id = _session AND v.place_id = pid
  ) c ON true
  ORDER BY COALESCE(c.yes, 0) DESC, COALESCE(c.no, 0) ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.outing_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outing_results(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Zamkniecie przez hosta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outing_close(_session uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.outing_sessions SET status = 'closed' WHERE id = _session AND host_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tylko organizator może zamknąć wyjście' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.outing_close(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outing_close(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Znajomi, ktorych mozna zaprosic (zaakceptowani, z aktywnym kontem)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outing_friends()
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, avatar_source text,
               is_vip boolean, vip_until timestamptz, vip_nick_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.avatar_source::text,
         p.is_vip, p.vip_until, p.vip_nick_color
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.display_name;
$$;
REVOKE ALL ON FUNCTION public.outing_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outing_friends() TO authenticated;
