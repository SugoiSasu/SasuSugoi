-- Ranking v2 (paczka designu "ranking", 2026-09-28).
--
-- Decyzje Mateusza:
--  - okresy Tydzien / Miesiac / Od poczatku sa TYLKO widokiem: tydzien i
--    miesiac kalendarzowy (czas polski) licza to, co zdobyto w tym czasie;
--    points_total i poziomy nigdy sie nie zeruja,
--  - metryki: Punkty / Recenzje / Odznaki (zamiast "Wizyt" z projektu - nie
--    mamy meldunkow, a status "odwiedzone" jest pusty),
--  - ekran porownania ze znajomym.
--
-- Widocznosc jak w polityce profiles (20260820120000): wlasny profil,
-- profil publiczny albo przyjaciel. Funkcja jest SECURITY DEFINER, wiec
-- warunek musi byc powtorzony tu - inaczej ranking ujawnialby profile
-- prywatne.

CREATE OR REPLACE FUNCTION public.ranking_tablica(_okres text, _metryka text)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_source text,
  gender text,
  is_vip boolean,
  vip_until timestamptz,
  vip_nick_color text,
  active_title text,
  points_total int,
  wartosc int,
  -- Wartosc sprzed 7 dni - tylko dla "Od poczatku" (zmiana miejsc w
  -- tygodniu). Dla tygodnia/miesiaca NULL: tam sam okres jest "zmiana".
  wartosc_tydzien_temu int,
  is_friend boolean,
  is_me boolean,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ramy AS (
    SELECT
      CASE _okres
        WHEN 'week' THEN date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'
        WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'
        ELSE '-infinity'::timestamptz
      END AS od,
      now() - interval '7 days' AS tydzien_temu
  ),
  widoczni AS (
    SELECT p.*
    FROM public.profiles p
    WHERE (p.username IS NOT NULL OR p.display_name IS NOT NULL)
      AND (p.id = auth.uid() OR p.is_public = true OR public.is_friend_with(p.id))
  ),
  wartosci AS (
    SELECT
      w.id,
      CASE _metryka
        WHEN 'reviews' THEN (SELECT count(*) FROM public.reviews r, ramy WHERE r.user_id = w.id AND r.created_at >= ramy.od)::int
        WHEN 'badges' THEN (SELECT count(*) FROM public.user_achievements ua, ramy WHERE ua.user_id = w.id AND ua.unlocked_at >= ramy.od)::int
        ELSE CASE WHEN _okres IN ('week', 'month')
          THEN (SELECT COALESCE(sum(t.points), 0) FROM public.points_transactions t, ramy WHERE t.user_id = w.id AND t.created_at >= ramy.od)::int
          ELSE COALESCE(w.points_total, 0)
        END
      END AS wartosc,
      CASE WHEN _okres IN ('week', 'month') THEN NULL ELSE
        CASE _metryka
          WHEN 'reviews' THEN (SELECT count(*) FROM public.reviews r, ramy WHERE r.user_id = w.id AND r.created_at < ramy.tydzien_temu)::int
          WHEN 'badges' THEN (SELECT count(*) FROM public.user_achievements ua, ramy WHERE ua.user_id = w.id AND ua.unlocked_at < ramy.tydzien_temu)::int
          ELSE COALESCE(w.points_total, 0)
            - (SELECT COALESCE(sum(t.points), 0) FROM public.points_transactions t, ramy WHERE t.user_id = w.id AND t.created_at >= ramy.tydzien_temu)::int
        END
      END AS wartosc_tydzien_temu
    FROM widoczni w
  )
  SELECT
    w.id, w.username::text, w.display_name::text, w.avatar_url::text, w.avatar_source::text, w.gender::text,
    w.is_vip, w.vip_until::timestamptz, w.vip_nick_color::text, w.active_title::text, COALESCE(w.points_total, 0)::int,
    v.wartosc, v.wartosc_tydzien_temu,
    public.is_friend_with(w.id), w.id = auth.uid(), w.created_at
  FROM widoczni w
  JOIN wartosci v ON v.id = w.id
  -- Zera tylko dla siebie i znajomych: ranking to lista tych, ktorzy cos
  -- zrobili, a nie katalog wszystkich kont (do tego jest wyszukiwarka).
  WHERE v.wartosc > 0 OR w.id = auth.uid() OR public.is_friend_with(w.id)
  ORDER BY v.wartosc DESC, w.created_at ASC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.ranking_tablica(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_tablica(text, text) TO anon, authenticated;

-- ── Porownanie ze znajomym ─────────────────────────────────────────────────
-- Tylko zalogowany i tylko z przyjacielem (albo profilem publicznym) - te
-- same zasady co odczyt profilu.
CREATE OR REPLACE FUNCTION public.porownanie_graczy(_inny uuid)
RETURNS TABLE (
  kto text,
  points_total int,
  recenzje int,
  odznaki int,
  lokale int,
  srednia_ocena numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ja uuid := auth.uid();
BEGIN
  IF v_ja IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _inny AND (p.is_public = true OR public.is_friend_with(p.id))
  ) THEN
    RAISE EXCEPTION 'not_visible';
  END IF;

  RETURN QUERY
  SELECT x.kto, COALESCE(p.points_total, 0),
    (SELECT count(*) FROM public.reviews r WHERE r.user_id = x.id)::int,
    (SELECT count(*) FROM public.user_achievements ua WHERE ua.user_id = x.id)::int,
    (SELECT count(DISTINCT r.place_id) FROM public.reviews r WHERE r.user_id = x.id)::int,
    (SELECT round(avg(r.rating)::numeric, 1) FROM public.reviews r WHERE r.user_id = x.id)
  FROM (VALUES ('ja', v_ja), ('on', _inny)) AS x(kto, id)
  JOIN public.profiles p ON p.id = x.id
  UNION ALL
  -- Wspolne lokale: te, ktore oboje zrecenzowali.
  SELECT 'wspolne', NULL, NULL, NULL,
    (SELECT count(*) FROM (
      SELECT place_id FROM public.reviews WHERE user_id = v_ja
      INTERSECT
      SELECT place_id FROM public.reviews WHERE user_id = _inny
    ) s)::int,
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.porownanie_graczy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.porownanie_graczy(uuid) TO authenticated;
