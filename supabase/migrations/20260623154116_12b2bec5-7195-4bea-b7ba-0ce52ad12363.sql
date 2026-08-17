-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  ref_type text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications owner read" ON public.notifications;
CREATE POLICY "notifications owner read" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications owner update" ON public.notifications;
CREATE POLICY "notifications owner update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications owner delete" ON public.notifications;
CREATE POLICY "notifications owner delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id) WHERE read_at IS NULL;

-- Helper to insert
CREATE OR REPLACE FUNCTION public.notify(_user_id uuid, _type text, _title text, _body text, _link text, _ref_type text, _ref_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.notifications(user_id, type, title, body, link, ref_type, ref_id)
  VALUES (_user_id, _type, _title, _body, _link, _ref_type, _ref_id);
$$;

-- Trigger: friendship insert (request) and update to accepted
CREATE OR REPLACE FUNCTION public.friendships_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(display_name, username, 'Ktoś') INTO v_name FROM public.profiles WHERE id = NEW.requester_id;
    PERFORM public.notify(
      NEW.addressee_id, 'friend_request',
      'Nowa propozycja znajomości',
      v_name || ' chce dodać Cię do znajomych.',
      '/profile/friends', 'friendship', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT COALESCE(display_name, username, 'Ktoś') INTO v_name FROM public.profiles WHERE id = NEW.addressee_id;
    PERFORM public.notify(
      NEW.requester_id, 'friend_accepted',
      'Macie nową znajomość 🎉',
      v_name || ' zaakceptował(a) Twoje zaproszenie.',
      '/profile/friends', 'friendship', NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS friendships_notify_ins ON public.friendships;
CREATE TRIGGER friendships_notify_ins AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_notify();
DROP TRIGGER IF EXISTS friendships_notify_upd ON public.friendships;
CREATE TRIGGER friendships_notify_upd AFTER UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_notify();

-- Trigger: new place_post → notify all users who favorited that place
CREATE OR REPLACE FUNCTION public.place_posts_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_slug text;
BEGIN
  SELECT name, slug INTO v_name, v_slug FROM public.places WHERE id = NEW.place_id;
  INSERT INTO public.notifications(user_id, type, title, body, link, ref_type, ref_id)
  SELECT pf.user_id,
         'place_post',
         'Nowość w ' || v_name,
         COALESCE(NEW.title, NEW.body),
         '/k/' || COALESCE(v_slug, NEW.place_id::text),
         'place_post', NEW.id
  FROM public.place_favorites pf
  WHERE pf.place_id = NEW.place_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS place_posts_notify_ins ON public.place_posts;
CREATE TRIGGER place_posts_notify_ins AFTER INSERT ON public.place_posts
  FOR EACH ROW EXECUTE FUNCTION public.place_posts_notify();

-- Trigger: user_achievements insert → notify owner
CREATE OR REPLACE FUNCTION public.user_achievements_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT name INTO v_name FROM public.achievements WHERE id = NEW.achievement_id;
  PERFORM public.notify(
    NEW.user_id, 'achievement',
    'Nowa odznaka!',
    'Zdobyłeś: ' || COALESCE(v_name, 'osiągnięcie'),
    '/profile', 'achievement', NEW.achievement_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_achievements_notify_ins ON public.user_achievements;
CREATE TRIGGER user_achievements_notify_ins AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.user_achievements_notify();

