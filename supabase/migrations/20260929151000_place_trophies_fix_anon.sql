-- Naprawa: place_trophies_for wolala has_role, do ktorego rola anon nie ma prawa
-- wykonania (patrz hardening z 2026-09-25) - gosc dostawal "permission denied".
-- is_admin() jest dla anon dostepne (zwraca false).
CREATE OR REPLACE FUNCTION public.place_trophies_for(_place_id uuid DEFAULT NULL)
RETURNS TABLE (place_id uuid, kind text, tier smallint, year integer, label text, source_url text, origin text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.place_id, t.kind, t.tier, t.year, t.label, t.source_url, 'reczne'::text
  FROM public.place_trophies t
  WHERE t.status = 'zatwierdzone' AND (_place_id IS NULL OR t.place_id = _place_id)
  UNION ALL
  SELECT w.place_id, 'warte_pozarcia'::text, NULL::smallint,
         extract(year FROM coalesce(e.closed_at, e.created_at))::integer,
         c.name, NULL::text, 'glosowanie'::text
  FROM public.award_winners w
  JOIN public.awards_events e ON e.id = w.event_id AND e.status = 'closed'
  JOIN public.cuisines c ON c.id = w.cuisine_id
  JOIN public.places p ON p.id = w.place_id
  WHERE (_place_id IS NULL OR w.place_id = _place_id)
    AND (p.is_published = true OR public.is_admin());
$$;
REVOKE ALL ON FUNCTION public.place_trophies_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_trophies_for(uuid) TO anon, authenticated;
