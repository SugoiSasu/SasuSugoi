-- 1) profiles: scrub emails out of display_name and stop using email as display_name on signup
UPDATE public.profiles
SET display_name = NULL
WHERE display_name ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avatar text;
  v_source text := 'initials';
  v_name text;
BEGIN
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  IF v_avatar IS NOT NULL THEN
    v_source := 'google';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  );
  -- Never use raw email as display_name (privacy).
  IF v_name IS NULL OR v_name ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    v_name := NULL;
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source)
  VALUES (NEW.id, v_name, v_avatar, v_source)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) place_visits: require authentication for reads
DROP POLICY IF EXISTS "place_visits public read" ON public.place_visits;
CREATE POLICY "place_visits authenticated read"
ON public.place_visits FOR SELECT
TO authenticated
USING (true);

-- 3) user_achievements: restrict read to self or public-profile owners
DROP POLICY IF EXISTS "user_achievements authenticated read" ON public.user_achievements;
CREATE POLICY "user_achievements read own or public"
ON public.user_achievements FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_achievements.user_id AND p.is_public = true
  )
);

-- 4) menu-images storage policies (admin manage, authenticated read)
DROP POLICY IF EXISTS "menu-images authenticated read" ON storage.objects;
CREATE POLICY "menu-images authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images admin insert" ON storage.objects;
CREATE POLICY "menu-images admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "menu-images admin update" ON storage.objects;
CREATE POLICY "menu-images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "menu-images admin delete" ON storage.objects;
CREATE POLICY "menu-images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

-- 5) Set search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 6) Lock down SECURITY DEFINER function EXECUTE grants.
-- Revoke from public/anon/authenticated, then grant only where intentional.

-- Trigger functions: no role should call directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.friendships_check_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.friendships_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_posts_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_comments_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_reactions_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_tags_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reviews_reverse_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_achievements_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_blocks_cleanup() FROM PUBLIC, anon, authenticated;

-- Internal helpers (called by other SECURITY DEFINER fns / triggers only)
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points(uuid, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;

-- pgmq wrappers: server-only (called from edge/server with service role)
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: limit to authenticated (in-function role check enforces admin)
REVOKE ALL ON FUNCTION public.alpha_gate_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_get() TO authenticated;
REVOKE ALL ON FUNCTION public.alpha_gate_set(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.ad_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_stats() TO authenticated;

-- Auth-only RPCs
REVOKE ALL ON FUNCTION public.accept_friend_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
REVOKE ALL ON FUNCTION public.friend_activity_feed(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_activity_feed(uuid, integer, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.friend_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.friends_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_of(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_friends_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friends_count(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Public-readable gate helpers (anon-visible app gate)
REVOKE ALL ON FUNCTION public.alpha_gate_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_enabled() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.alpha_gate_verify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_verify(text) TO anon, authenticated;

