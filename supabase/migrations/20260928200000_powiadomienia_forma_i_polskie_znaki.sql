-- Powiadomienia: forma zgodna z plcia, polskie znaki, sprzatanie po testach.
-- Zrzuty Mateusza z telefonu 2026-09-28.

-- 1. Odznaka: "Zdobyles:" szlo do kazdego. K -> "Zdobylas", M -> "Zdobyles",
--    plec nieznana -> forma bezosobowa.
CREATE OR REPLACE FUNCTION public.user_achievements_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_gender text;
BEGIN
  SELECT name INTO v_name FROM public.achievements WHERE id = NEW.achievement_id;
  SELECT gender INTO v_gender FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(
    NEW.user_id, 'achievement',
    'Nowa odznaka!',
    CASE v_gender
      WHEN 'K' THEN 'Zdobyłaś: '
      WHEN 'M' THEN 'Zdobyłeś: '
      ELSE 'Odznaka zdobyta: '
    END || COALESCE(v_name, 'osiągnięcie'),
    '/profile', 'achievement', NEW.achievement_id
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.user_achievements_notify() FROM PUBLIC, anon, authenticated;

-- 2. Zgloszenie wlasciciela: tresc z 20260823200100, tylko polskie znaki.
CREATE OR REPLACE FUNCTION public.owner_requests_notify_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_place text; v_slug text; v_admin uuid;
BEGIN
  SELECT name, slug INTO v_place, v_slug FROM public.places WHERE id = NEW.place_id;
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','super_admin') LOOP
    PERFORM public.notify(
      v_admin, 'owner_request',
      'Nowe zgłoszenie właściciela',
      NEW.name || ' zgłasza się jako właściciel: ' || COALESCE(v_place, ''),
      '/admin/moderacja',
      'owner_request', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

-- 3. Istniejace powiadomienia - ta sama poprawka wstecz.
UPDATE public.notifications n
SET body = 'Zdobyłaś: ' || substring(n.body FROM length('Zdobyłeś: ') + 1)
FROM public.profiles p
WHERE p.id = n.user_id AND p.gender = 'K' AND n.body LIKE 'Zdobyłeś: %';

UPDATE public.notifications n
SET body = 'Odznaka zdobyta: ' || substring(n.body FROM length('Zdobyłeś: ') + 1)
FROM public.profiles p
WHERE p.id = n.user_id AND p.gender IS NULL AND n.body LIKE 'Zdobyłeś: %';

UPDATE public.notifications
SET title = 'Nowe zgłoszenie właściciela',
    body = replace(replace(replace(body, ' zglasza sie jako wlasciciel ', ' zgłasza się jako właściciel: '), 'zglasza', 'zgłasza'), 'wlasciciel', 'właściciel')
WHERE title = 'Nowe zgloszenie wlasciciela';

-- 4. Smieci po testach przeplywu wlasciciela (sierpien): 8 powiadomien
--    "PZ_PROBE ..." u adminow. Zgloszen PZ_PROBE juz nie ma - to sieroty.
DELETE FROM public.notifications WHERE body LIKE 'PZ_PROBE%';
