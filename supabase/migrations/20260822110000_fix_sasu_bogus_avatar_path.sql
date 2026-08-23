-- Test profile "@sasu" (005263ab-eb1f-44ee-bff1-2fe0aba1189b) has
-- avatar_url = '89e4e471-4931-43b9-8622-f0bfa5718c73/avatar-1781783245081.png'
-- - a storage path prefixed with a DIFFERENT user's id, not this profile's
-- own id, so it was never a valid path for this account (storage RLS scopes
-- uploads to "{own_user_id}/..."). Confirmed via byte-for-byte lookup: no
-- profile exists with that other id at all, and the client repeatedly
-- retries signing this dead path (createSignedUrl -> 400) on every render
-- of this profile's avatar anywhere it appears (e.g. the /u ranking page),
-- spamming failed requests. UI already degrades to initials gracefully -
-- this is a pure data cleanup, no functional regression either way.
UPDATE public.profiles
SET avatar_url = NULL,
    avatar_source = 'initials'
WHERE id = '005263ab-eb1f-44ee-bff1-2fe0aba1189b'
  AND avatar_url = '89e4e471-4931-43b9-8622-f0bfa5718c73/avatar-1781783245081.png';
