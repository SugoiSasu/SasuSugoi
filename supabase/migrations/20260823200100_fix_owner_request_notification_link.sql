-- owner_requests_notify_admin() (migration 20260707002051) links admins to
-- '/admin/owner-requests', a route that was never created - the real moderation
-- UI lives at '/admin/moderacja' (Właściciele tab), see admin.moderacja.tsx.
-- Clicking the notification currently 404s. Point it at the real route.
CREATE OR REPLACE FUNCTION public.owner_requests_notify_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_place text; v_slug text; v_admin uuid;
BEGIN
  SELECT name, slug INTO v_place, v_slug FROM public.places WHERE id = NEW.place_id;
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','super_admin') LOOP
    PERFORM public.notify(
      v_admin, 'owner_request',
      'Nowe zgloszenie wlasciciela',
      NEW.name || ' zglasza sie jako wlasciciel ' || COALESCE(v_place, ''),
      '/admin/moderacja',
      'owner_request', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;
