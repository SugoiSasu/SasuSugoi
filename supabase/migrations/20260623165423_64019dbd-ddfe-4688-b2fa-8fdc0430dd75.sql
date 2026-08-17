-- Friends expansion: schema, RLS, helpers, triggers, realtime

CREATE TABLE public.friend_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_favorites TO authenticated;
GRANT ALL ON public.friend_favorites TO service_role;
ALTER TABLE public.friend_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ff_owner_all" ON public.friend_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.friend_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_lists TO authenticated;
GRANT ALL ON public.friend_lists TO service_role;
ALTER TABLE public.friend_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fl_owner_all" ON public.friend_lists FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_friend_lists_updated BEFORE UPDATE ON public.friend_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.friend_list_members (
  list_id uuid NOT NULL REFERENCES public.friend_lists(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_list_members TO authenticated;
GRANT ALL ON public.friend_list_members TO service_role;
ALTER TABLE public.friend_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flm_owner_all" ON public.friend_list_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.friend_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.friend_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

CREATE TABLE public.friend_notes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_notes TO authenticated;
GRANT ALL ON public.friend_notes TO service_role;
ALTER TABLE public.friend_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fn_owner_all" ON public.friend_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_friend_notes_updated BEFORE UPDATE ON public.friend_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_owner_all" ON public.user_blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_blocks_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (requester_id = NEW.blocker_id AND addressee_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND addressee_id = NEW.blocker_id);
  DELETE FROM public.friend_favorites
  WHERE (user_id = NEW.blocker_id AND friend_id = NEW.blocked_id)
     OR (user_id = NEW.blocked_id AND friend_id = NEW.blocker_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_user_blocks_cleanup AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.user_blocks_cleanup();

CREATE TABLE public.friend_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_friend_invites_token ON public.friend_invites(token);
CREATE INDEX idx_friend_invites_inviter ON public.friend_invites(inviter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_invites TO authenticated;
GRANT ALL ON public.friend_invites TO service_role;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fi_owner_select" ON public.friend_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid());
CREATE POLICY "fi_owner_insert" ON public.friend_invites FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid());
CREATE POLICY "fi_owner_update" ON public.friend_invites FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid()) WITH CHECK (inviter_id = auth.uid());
CREATE POLICY "fi_owner_delete" ON public.friend_invites FOR DELETE TO authenticated
  USING (inviter_id = auth.uid());

CREATE TABLE public.review_tags (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, tagged_user_id)
);
CREATE INDEX idx_review_tags_user ON public.review_tags(tagged_user_id);
GRANT SELECT ON public.review_tags TO anon;
GRANT SELECT, INSERT, DELETE ON public.review_tags TO authenticated;
GRANT ALL ON public.review_tags TO service_role;
ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_select_all" ON public.review_tags FOR SELECT USING (true);
CREATE POLICY "rt_insert_tagger" ON public.review_tags FOR INSERT TO authenticated
  WITH CHECK (
    tagger_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = tagged_user_id AND blocked_id = auth.uid())
         OR (blocker_id = auth.uid() AND blocked_id = tagged_user_id)
    )
  );
CREATE POLICY "rt_delete_owner" ON public.review_tags FOR DELETE TO authenticated
  USING (tagger_id = auth.uid() OR tagged_user_id = auth.uid());

CREATE TABLE public.review_reactions (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id, type)
);
CREATE INDEX idx_review_reactions_review ON public.review_reactions(review_id);
GRANT SELECT ON public.review_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.review_reactions TO authenticated;
GRANT ALL ON public.review_reactions TO service_role;
ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_select_all" ON public.review_reactions FOR SELECT USING (true);
CREATE POLICY "rr_insert_self" ON public.review_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      JOIN public.reviews r ON r.id = review_id
      WHERE (ub.blocker_id = r.user_id AND ub.blocked_id = auth.uid())
         OR (ub.blocker_id = auth.uid() AND ub.blocked_id = r.user_id)
    )
  );
CREATE POLICY "rr_delete_self" ON public.review_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_comments_review ON public.review_comments(review_id);
GRANT SELECT ON public.review_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_comments TO authenticated;
GRANT ALL ON public.review_comments TO service_role;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_select_all" ON public.review_comments FOR SELECT USING (true);
CREATE POLICY "rc_insert_self" ON public.review_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      JOIN public.reviews r ON r.id = review_id
      WHERE (ub.blocker_id = r.user_id AND ub.blocked_id = auth.uid())
         OR (ub.blocker_id = auth.uid() AND ub.blocked_id = r.user_id)
    )
  );
CREATE POLICY "rc_update_self" ON public.review_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "rc_delete_self" ON public.review_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER trg_review_comments_updated BEFORE UPDATE ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper functions

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;

CREATE OR REPLACE FUNCTION public.friends_of(_user uuid)
RETURNS TABLE(friend_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN requester_id = _user THEN addressee_id ELSE requester_id END
  FROM public.friendships
  WHERE status = 'accepted' AND (requester_id = _user OR addressee_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.friend_activity_feed(_user uuid, _limit int DEFAULT 20, _before timestamptz DEFAULT NULL)
RETURNS TABLE(
  kind text,
  review_id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  place_id uuid,
  place_name text,
  place_slug text,
  rating int,
  body text,
  photo_url text,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH fr AS (SELECT friend_id FROM public.friends_of(_user))
  SELECT
    'review'::text,
    r.id,
    r.user_id,
    COALESCE(p.display_name, p.username, 'Ktos'),
    p.avatar_url,
    r.place_id,
    pl.name,
    pl.slug,
    r.rating::int,
    r.body,
    r.photo_url,
    r.created_at
  FROM public.reviews r
  JOIN fr ON fr.friend_id = r.user_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.places pl ON pl.id = r.place_id
  WHERE (_before IS NULL OR r.created_at < _before)
    AND NOT public.is_blocked(_user, r.user_id)
  ORDER BY r.created_at DESC
  LIMIT GREATEST(_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.friend_leaderboard(_user uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  points_total int,
  reviews_count int,
  achievements_count int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT _user AS uid
    UNION
    SELECT friend_id FROM public.friends_of(_user)
  )
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    COALESCE(p.points_total, 0)::int,
    (SELECT count(*)::int FROM public.reviews r WHERE r.user_id = p.id),
    (SELECT count(*)::int FROM public.user_achievements ua WHERE ua.user_id = p.id)
  FROM ids
  JOIN public.profiles p ON p.id = ids.uid
  ORDER BY COALESCE(p.points_total, 0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.friend_invites; v_uid uuid; v_fid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_inv FROM public.friend_invites WHERE token = _token;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invite_used'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.friend_invites SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;
  IF v_inv.inviter_id = v_uid THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;
  IF public.is_blocked(v_uid, v_inv.inviter_id) THEN RAISE EXCEPTION 'blocked'; END IF;

  INSERT INTO public.friendships(requester_id, addressee_id, status)
  VALUES (v_inv.inviter_id, v_uid, 'accepted')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_fid;

  IF v_fid IS NULL THEN
    SELECT id INTO v_fid FROM public.friendships
    WHERE (requester_id = v_inv.inviter_id AND addressee_id = v_uid)
       OR (requester_id = v_uid AND addressee_id = v_inv.inviter_id);
    UPDATE public.friendships SET status = 'accepted' WHERE id = v_fid;
  END IF;

  UPDATE public.friend_invites
    SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
    WHERE id = v_inv.id;
  RETURN v_fid;
END $$;

-- Notification triggers

CREATE OR REPLACE FUNCTION public.review_tags_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_place text; v_slug text;
BEGIN
  IF NEW.tagged_user_id = NEW.tagger_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_name FROM public.profiles WHERE id = NEW.tagger_id;
  SELECT pl.name, pl.slug INTO v_place, v_slug
    FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
    WHERE r.id = NEW.review_id;
  PERFORM public.notify(
    NEW.tagged_user_id, 'review_tag',
    'Oznaczono Cie w recenzji',
    v_name || ' oznaczyl(a) Cie w recenzji ' || COALESCE(v_place, ''),
    '/k/' || COALESCE(v_slug, ''),
    'review', NEW.review_id
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_review_tags_notify AFTER INSERT ON public.review_tags
  FOR EACH ROW EXECUTE FUNCTION public.review_tags_notify();

CREATE OR REPLACE FUNCTION public.review_reactions_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_slug text; v_place text;
BEGIN
  SELECT r.user_id, pl.name, pl.slug INTO v_owner, v_place, v_slug
    FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
    WHERE r.id = NEW.review_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(
    v_owner, 'review_reaction',
    'Nowa reakcja',
    v_name || ' zareagowal(a) na Twoja recenzje ' || COALESCE(v_place, ''),
    '/k/' || COALESCE(v_slug, ''),
    'review', NEW.review_id
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_review_reactions_notify AFTER INSERT ON public.review_reactions
  FOR EACH ROW EXECUTE FUNCTION public.review_reactions_notify();

CREATE OR REPLACE FUNCTION public.review_comments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_slug text; v_place text;
BEGIN
  SELECT r.user_id, pl.name, pl.slug INTO v_owner, v_place, v_slug
    FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
    WHERE r.id = NEW.review_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(
    v_owner, 'review_comment',
    'Nowy komentarz',
    v_name || ' skomentowal(a) Twoja recenzje ' || COALESCE(v_place, ''),
    '/k/' || COALESCE(v_slug, ''),
    'review', NEW.review_id
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_review_comments_notify AFTER INSERT ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.review_comments_notify();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_invites;

