-- Per-user notification preferences, one boolean per NOTIFICATION_TYPES entry
-- (src/lib/notifications-api.ts). Defaults to everything on so existing users
-- see no behavior change until they actually open Settings and turn something
-- off. public.notify() now checks this before inserting a row, so a disabled
-- type is centrally suppressed at the single place all notification triggers
-- funnel through, instead of needing per-trigger changes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
    'friend_request', true,
    'friend_accepted', true,
    'place_post', true,
    'achievement', true
  );

CREATE OR REPLACE FUNCTION public.notify(_user_id uuid, _type text, _title text, _body text, _link text, _ref_type text, _ref_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_enabled boolean;
BEGIN
  SELECT COALESCE((notification_prefs->>_type)::boolean, true) INTO v_enabled
  FROM public.profiles WHERE id = _user_id;
  IF COALESCE(v_enabled, true) IS FALSE THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link, ref_type, ref_id)
  VALUES (_user_id, _type, _title, _body, _link, _ref_type, _ref_id);
END;
$$;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Dodano zarządzanie powiadomieniami w Ustawieniach - można wyłączyć wybrane typy (zaproszenia do znajomych, posty ulubionych miejsc, osiągnięcia).');
