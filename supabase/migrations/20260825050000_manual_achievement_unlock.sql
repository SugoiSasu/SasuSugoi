-- Not every achievement fits the existing threshold-based criteria model
-- (reviews_count/unique_places/points_total/friends_count/referrals_count,
-- all unlocked automatically by server-side triggers watching those stats).
-- A "find your own location dot on the map" achievement is a one-time
-- discovery action, not a countable stat - it needs a client-triggerable
-- unlock instead. user_achievements has no client INSERT policy at all
-- (every existing row comes from a SECURITY DEFINER trigger), so this adds
-- a narrow, reusable RPC for that one case rather than opening the table
-- up broadly.
CREATE OR REPLACE FUNCTION public.unlock_manual_achievement(_slug text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_achievement_id uuid;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_achievement_id
  FROM public.achievements
  WHERE slug = _slug AND enabled = true AND (criteria->>'type') = 'manual';
  IF v_achievement_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_achievements
    WHERE user_id = auth.uid() AND achievement_id = v_achievement_id
  ) INTO v_already;
  IF v_already THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (auth.uid(), v_achievement_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.unlock_manual_achievement(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_manual_achievement(text) TO authenticated;

INSERT INTO public.achievements (slug, name, description, criteria, sort_order, enabled)
VALUES (
  'found_yourself',
  'To Ty!',
  'Znajdź swoją kropkę na mapie',
  jsonb_build_object('type', 'manual'),
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.achievements),
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Dodano odznakę "To Ty!" za odnalezienie własnej lokalizacji na mapie, plus ogólny mechanizm ręcznego odblokowywania odznak dla przyszłych podobnych funkcji.');
