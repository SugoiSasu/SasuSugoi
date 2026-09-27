-- Uzupelnienie profilu nie uruchamialo sprawdzenia odznak.
--
-- check_achievements() jest wolane z triggerow na recenzjach, punktach i
-- zaproszeniach. Na `profiles` triggera nie bylo, a jedno z 44 kryteriow
-- (`profile_completed`: awatar + bio) zalezy wylacznie od tej tabeli. Skutek:
-- odznaka nalezala sie od razu po uzupelnieniu profilu, ale wpadala dopiero
-- przy nastepnej akcji, ktora odpalala silnik - a kto uzupelnil profil i nic
-- wiecej nie zrobil, nie dostawal jej NIGDY.
--
-- Zlapane 2026-09-27 na koncie z 2026-08-25: awatar i bio wypelnione, zero
-- recenzji, odznaki brak.

CREATE OR REPLACE FUNCTION public.profiles_check_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_check_achievements() FROM PUBLIC, anon, authenticated;

-- UPDATE OF zawezone do dwoch kolumn PLUS warunek WHEN, zeby nie zapetlic sie
-- z user_achievements_grant_vip: ten trigger po przyznaniu 'inviter_10'
-- aktualizuje profiles.is_vip. Nie dotyka avatar_url ani bio, wiec przy takim
-- zawezeniu nasz trigger sie nie odpali i rekurencji nie ma.
DROP TRIGGER IF EXISTS profiles_check_achievements_after_update ON public.profiles;
CREATE TRIGGER profiles_check_achievements_after_update
  AFTER UPDATE OF avatar_url, bio ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
    OR OLD.bio IS DISTINCT FROM NEW.bio
  )
  EXECUTE FUNCTION public.profiles_check_achievements();

-- Nadrobienie zaleglosci dla kont, ktore juz maja komplet.
-- Warunek EXISTS na auth.users jest konieczny: w bazie siedzi 6 osieroconych
-- profili z migracji z Lovable, bez wiersza w auth.users. Dla nich INSERT do
-- user_achievements wywala sie na kluczu obcym i przerwalby cala petle.
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN
    SELECT p.id FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id)
  LOOP
    PERFORM public.check_achievements(u);
  END LOOP;
END $$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Trigger na profiles: uzupelnienie awatara lub bio uruchamia sprawdzenie odznak (profile_completed nie wpadalo do momentu innej akcji).');
