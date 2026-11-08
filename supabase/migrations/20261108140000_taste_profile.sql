-- Taste Profile i Match Score.
--
-- Profil gustu = wagi kuchni z: ulubionych kuchni z profilu (+3), wizyt "bylem" (+2) / "chce" (+1), ulubionych
-- lokali (+2) i ocen (>=4: +2, <=2: -1). Zgodnosc dwoch osob = podobienstwo kosinusowe wag kuchni (60%),
-- czesc wspolna miejsc (Jaccard, 30%) i zgodnosc ocen tych samych lokali (10%); skladniki, ktorych nie da sie
-- policzyc, sa pomijane (reszta jest renormalizowana). Gdy ktorakolwiek strona ma < 3 sygnalow, zwracamy
-- "za_malo_danych" zamiast przypadkowej liczby.
--
-- Prywatnosc: profil gustu widzi tylko wlasciciel i jego zaakceptowani znajomi; zgodnosc liczy sie tylko ze znajomym.
-- Funkcje pomocnicze sa wewnetrzne (bez EXECUTE dla anon/authenticated).

CREATE OR REPLACE FUNCTION public.taste_weights(_user uuid)
RETURNS TABLE (cuisine text, weight numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH sygnaly AS (
    SELECT unnest(p.favorite_cuisines)::text AS cuisine, 3::numeric AS w
      FROM public.profiles p WHERE p.id = _user
    UNION ALL
    SELECT pl.cuisine::text, CASE v.status::text WHEN 'visited' THEN 2 ELSE 1 END
      FROM public.place_visits v JOIN public.places pl ON pl.id = v.place_id
      WHERE v.user_id = _user AND pl.is_published IS NOT FALSE
    UNION ALL
    SELECT pl.cuisine::text, 2
      FROM public.place_favorites f JOIN public.places pl ON pl.id = f.place_id
      WHERE f.user_id = _user AND pl.is_published IS NOT FALSE
    UNION ALL
    SELECT pl.cuisine::text, CASE WHEN r.rating >= 4 THEN 2 WHEN r.rating <= 2 THEN -1 ELSE 0 END
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user AND pl.is_published IS NOT FALSE
  )
  SELECT s.cuisine, sum(s.w)::numeric
  FROM sygnaly s
  WHERE s.cuisine IS NOT NULL AND btrim(s.cuisine) <> ''
  GROUP BY s.cuisine
  HAVING sum(s.w) > 0;
$$;

CREATE OR REPLACE FUNCTION public.taste_places(_user uuid)
RETURNS TABLE (pid uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.place_id FROM public.place_visits v WHERE v.user_id = _user
  UNION
  SELECT f.place_id FROM public.place_favorites f WHERE f.user_id = _user;
$$;

CREATE OR REPLACE FUNCTION public.taste_signals(_user uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    COALESCE((SELECT cardinality(favorite_cuisines) FROM public.profiles WHERE id = _user), 0)
    + (SELECT count(*) FROM public.place_visits WHERE user_id = _user)
    + (SELECT count(*) FROM public.place_favorites WHERE user_id = _user)
    + (SELECT count(*) FROM public.reviews WHERE user_id = _user)
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.taste_can_view(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _user = auth.uid() OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = _user)
          OR (f.addressee_id = auth.uid() AND f.requester_id = _user))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.taste_weights(uuid), public.taste_places(uuid), public.taste_signals(uuid), public.taste_can_view(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profil gustu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taste_profile(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NOT public.taste_can_view(_user) THEN
    RAISE EXCEPTION 'Nie masz dostępu do tego profilu gustu' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(sum(weight), 0) INTO v_total FROM public.taste_weights(_user);

  RETURN jsonb_build_object(
    'user_id', _user,
    'signals', public.taste_signals(_user),
    'cuisines', CASE WHEN v_total > 0 THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cuisine', t.cuisine, 'share', round(100 * t.weight / v_total)))
      FROM (SELECT * FROM public.taste_weights(_user) ORDER BY weight DESC, cuisine LIMIT 5) t
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'districts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('district', d.district, 'count', d.n))
      FROM (
        SELECT pl.district, count(*) AS n
        FROM public.places pl
        WHERE pl.id IN (SELECT pid FROM public.taste_places(_user))
          AND pl.district IS NOT NULL AND btrim(pl.district) <> ''
        GROUP BY pl.district ORDER BY n DESC, pl.district LIMIT 3
      ) d
    ), '[]'::jsonb),
    'visited', (SELECT count(*) FROM public.place_visits WHERE user_id = _user AND status::text = 'visited'),
    'favorites', (SELECT count(*) FROM public.place_favorites WHERE user_id = _user)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.taste_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taste_profile(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Zgodnosc ze znajomym
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taste_match(_friend uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  s_me integer;
  s_fr integer;
  dot numeric;
  na numeric;
  nb numeric;
  inter integer;
  uni integer;
  agr numeric;
  acc numeric := 0;
  w numeric := 0;
  v_score integer;
BEGIN
  IF v_me IS NULL OR _friend IS NULL OR _friend = v_me OR NOT public.taste_can_view(_friend) THEN
    RAISE EXCEPTION 'Zgodność liczy się tylko ze znajomymi' USING ERRCODE = '42501';
  END IF;

  s_me := public.taste_signals(v_me);
  s_fr := public.taste_signals(_friend);
  IF s_me < 3 OR s_fr < 3 THEN
    RETURN jsonb_build_object('score', NULL, 'reason', 'za_malo_danych', 'signals_me', s_me, 'signals_them', s_fr);
  END IF;

  -- 1) kuchnie: podobienstwo kosinusowe
  SELECT COALESCE(sum(a.weight * b.weight), 0) INTO dot
  FROM public.taste_weights(v_me) a JOIN public.taste_weights(_friend) b USING (cuisine);
  SELECT COALESCE(sqrt(sum(weight * weight)), 0) INTO na FROM public.taste_weights(v_me);
  SELECT COALESCE(sqrt(sum(weight * weight)), 0) INTO nb FROM public.taste_weights(_friend);
  IF na > 0 AND nb > 0 THEN
    acc := acc + 0.6 * (dot / (na * nb));
    w := w + 0.6;
  END IF;

  -- 2) wspolne miejsca: Jaccard
  SELECT count(*) INTO inter FROM (
    SELECT pid FROM public.taste_places(v_me) INTERSECT SELECT pid FROM public.taste_places(_friend)
  ) x;
  SELECT count(*) INTO uni FROM (
    SELECT pid FROM public.taste_places(v_me) UNION SELECT pid FROM public.taste_places(_friend)
  ) x;
  IF uni > 0 THEN
    acc := acc + 0.3 * (inter::numeric / uni);
    w := w + 0.3;
  END IF;

  -- 3) zgodnosc ocen tych samych lokali
  SELECT avg(1 - abs(a.rating - b.rating) / 4.0) INTO agr
  FROM public.reviews a JOIN public.reviews b ON b.place_id = a.place_id
  WHERE a.user_id = v_me AND b.user_id = _friend;
  IF agr IS NOT NULL THEN
    acc := acc + 0.1 * agr;
    w := w + 0.1;
  END IF;

  v_score := CASE WHEN w > 0 THEN round(100 * acc / w)::integer ELSE NULL END;

  RETURN jsonb_build_object(
    'score', v_score,
    'reason', CASE WHEN v_score IS NULL THEN 'za_malo_danych' ELSE NULL END,
    'signals_me', s_me,
    'signals_them', s_fr,
    'shared_cuisines', COALESCE((
      SELECT jsonb_agg(c.cuisine) FROM (
        SELECT a.cuisine FROM public.taste_weights(v_me) a JOIN public.taste_weights(_friend) b USING (cuisine)
        ORDER BY least(a.weight, b.weight) DESC, a.cuisine LIMIT 3
      ) c
    ), '[]'::jsonb),
    'common_places', COALESCE((
      SELECT jsonb_agg(p.pid) FROM (
        SELECT pid FROM public.taste_places(v_me) INTERSECT SELECT pid FROM public.taste_places(_friend) LIMIT 5
      ) p
    ), '[]'::jsonb),
    'their_top', COALESCE((
      SELECT jsonb_agg(t.cuisine) FROM (
        SELECT cuisine FROM public.taste_weights(_friend) ORDER BY weight DESC, cuisine LIMIT 3
      ) t
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.taste_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taste_match(uuid) TO authenticated;
