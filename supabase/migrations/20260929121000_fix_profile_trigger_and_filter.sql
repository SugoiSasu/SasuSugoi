-- 1. PILNE: zapis profilu (bio / awatar) konczyl sie bledem
--    'malformed array literal: "profile_completed"'.
--
-- Trigger profiles_check_achievements (20260928150000) robil
--   v_typy := v_typy || 'profile_completed';
-- a text[] || nietypowany literal Postgres czyta jako TABLICE, nie element.
-- Blad wychodzil przy kazdej zmianie awatara lub bio - czyli przy zapisie
-- profilu przez uzytkownikow. Testy tamtej migracji obejmowaly lajki,
-- komentarze i edycje recenzji, ale nie zapis profilu.
CREATE OR REPLACE FUNCTION public.profiles_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_typy text[] := ARRAY[]::text[];
BEGIN
  IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url OR OLD.bio IS DISTINCT FROM NEW.bio THEN
    v_typy := array_append(v_typy, 'profile_completed'::text);
  END IF;
  IF OLD.points_total IS DISTINCT FROM NEW.points_total THEN
    v_typy := v_typy || ARRAY['points_total', 'ranking_position']::text[];
  END IF;
  IF coalesce(array_length(v_typy, 1), 0) > 0 THEN
    PERFORM public.check_achievements(NEW.id, v_typy);
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Filtr: "k*rwa" po usunieciu gwiazdki to "krwa" - nie lapane przez "kurw".
INSERT INTO public.moderation_terms (pattern, kind, note) VALUES
  ('\yku?rw(a|y|o|ie|ami|om|ach)\y', 'block', 'wulgaryzm (zamaskowany)');
