DROP POLICY IF EXISTS "anyone can read profiles" ON public.profiles;
CREATE POLICY "anon reads public profiles" ON public.profiles FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "authenticated reads profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "place_owners public read verified" ON public.place_owners;
CREATE POLICY "place_owners authenticated read verified" ON public.place_owners FOR SELECT TO authenticated USING (verified = true);

DROP POLICY IF EXISTS "menu-images authenticated read" ON storage.objects;
CREATE POLICY "menu-images admin read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Anyone can submit collab with consent" ON public.collab_submissions;
CREATE POLICY "Anyone can submit collab with consent" ON public.collab_submissions FOR INSERT
  WITH CHECK (
    consent_version IS NOT NULL
    AND length(consent_version) > 0
    AND consent_accepted_at IS NOT NULL
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) BETWEEN 5 AND 200
    AND brand IS NOT NULL
    AND length(brand) BETWEEN 2 AND 100
    AND message IS NOT NULL
    AND length(message) BETWEEN 10 AND 2000
  );

DROP POLICY IF EXISTS "anyone can submit suggestion" ON public.place_suggestions;
CREATE POLICY "anyone can submit suggestion" ON public.place_suggestions FOR INSERT
  WITH CHECK (
    name IS NOT NULL
    AND length(btrim(name)) BETWEEN 2 AND 200
    AND address IS NOT NULL
    AND length(btrim(address)) BETWEEN 3 AND 300
    AND (notes IS NULL OR length(notes) <= 2000)
  );

ALTER FUNCTION public.enqueue_email(text, jsonb)                   SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer)     SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)                   SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)       SET search_path = public;

DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT unnest(ARRAY[
      'public.friendships_check_achievements()',
      'public.friendships_notify()',
      'public.handle_new_user()',
      'public.owner_requests_notify_admin()',
      'public.place_favorites_notify_owner()',
      'public.place_follows_notify_owner()',
      'public.place_post_comments_notify()',
      'public.place_post_reactions_notify()',
      'public.place_posts_notify()',
      'public.places_set_slug()',
      'public.review_comments_notify()',
      'public.review_reactions_notify()',
      'public.review_replies_notify_author()',
      'public.review_tags_notify()',
      'public.reviews_award_on_insert()',
      'public.reviews_notify_owner()',
      'public.reviews_reverse_on_delete()',
      'public.set_updated_at()',
      'public.user_achievements_notify()',
      'public.user_blocks_cleanup()'
      -- MIGRATION NOTE: 'public.email_queue_dispatch()' and 'public.email_queue_wake()'
      -- were dropped from this list — they're never CREATEd anywhere in the exported
      -- migration history, meaning they were pg_cron scheduled functions set up
      -- directly via the Supabase Dashboard Cron UI rather than tracked migrations.
      -- Recreate + re-add the REVOKE here once queue dispatch is wired up on the
      -- new project (Vercel Cron is the likely replacement, see PROJECT_BRIEF.md).
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.accept_friend_invite(text)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ad_stats()                                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_get()                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.friend_activity_feed(uuid, integer, timestamptz)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.friend_leaderboard(uuid)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.friends_of(uuid)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_friends_count(uuid)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_users(text)                                FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, text, uuid, integer)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, text, text, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)            FROM PUBLIC, anon, authenticated;

