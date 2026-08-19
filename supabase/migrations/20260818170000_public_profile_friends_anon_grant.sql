-- The public profile page (/u/$username) shows the profile owner's friend
-- count and friend list to anonymous visitors, same as a follower count on
-- any public social profile. get_friends_count originally granted EXECUTE
-- to anon (20260623131957) but a later migration (20260624112621) revoked
-- it and only granted authenticated, alongside friends_of which never had
-- an anon grant. Both functions only return friend ids/count, which is no
-- more sensitive than the profiles rows anon can already read directly.
GRANT EXECUTE ON FUNCTION public.get_friends_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.friends_of(uuid) TO anon;
