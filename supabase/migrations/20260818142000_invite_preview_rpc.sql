-- Lets the /zaproszenie/$token landing page show "X Cię zaprosił!" before the
-- visitor is logged in, without loosening RLS on friend_invites (which only
-- lets the inviter read their own rows). Safe because the token itself is
-- the unguessable secret — this never enumerates invites, only resolves one
-- exact token to minimal, non-sensitive preview fields.
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS TABLE(
  inviter_display_name text,
  inviter_username text,
  inviter_avatar_url text,
  status text,
  expired boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.display_name,
    p.username,
    p.avatar_url,
    fi.status,
    fi.expires_at < now()
  FROM public.friend_invites fi
  JOIN public.profiles p ON p.id = fi.inviter_id
  WHERE fi.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;
