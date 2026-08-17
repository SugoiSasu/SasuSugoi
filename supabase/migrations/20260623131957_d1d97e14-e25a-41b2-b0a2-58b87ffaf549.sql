CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> addressee_id),
  -- canonical pair uniqueness: smaller id first
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);

-- prevent reverse duplicate (B->A when A->B exists)
CREATE UNIQUE INDEX friendships_unique_pair_norm
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships participant read" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships requester insert" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "friendships addressee respond" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "friendships participant delete" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE INDEX friendships_requester_idx ON public.friendships(requester_id);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id);

-- Public helper: friends count for any user (used on public profile)
CREATE OR REPLACE FUNCTION public.get_friends_count(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM public.friendships
  WHERE status = 'accepted' AND (requester_id = _user_id OR addressee_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.get_friends_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_count(uuid) TO anon, authenticated;

