CREATE OR REPLACE FUNCTION public.friendships_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(display_name, username, 'Ktoś') INTO v_name FROM public.profiles WHERE id = NEW.requester_id;
    PERFORM public.notify(
      NEW.addressee_id, 'friend_request',
      'Nowa propozycja znajomości',
      v_name || ' chce dodać Cię do znajomych.',
      '/friends?tab=requests', 'friendship', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT COALESCE(display_name, username, 'Ktoś') INTO v_name FROM public.profiles WHERE id = NEW.addressee_id;
    PERFORM public.notify(
      NEW.requester_id, 'friend_accepted',
      'Macie nową znajomość 🎉',
      v_name || ' zaakceptował(a) Twoje zaproszenie.',
      '/friends', 'friendship', NEW.id
    );
  END IF;
  RETURN NEW;
END $function$;

-- Update existing notification links so old rows point to the new hub
UPDATE public.notifications SET link = '/friends?tab=requests'
WHERE type = 'friend_request' AND link = '/profile/friends';

UPDATE public.notifications SET link = '/friends'
WHERE type = 'friend_accepted' AND link = '/profile/friends';

