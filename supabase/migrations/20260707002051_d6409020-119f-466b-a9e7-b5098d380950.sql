-- =========================================================
-- OWNER SYSTEM: fundament
-- =========================================================

-- 1) place_owners
CREATE TABLE public.place_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id)
);
CREATE INDEX place_owners_user_idx ON public.place_owners(user_id);
GRANT SELECT ON public.place_owners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_owners TO authenticated;
GRANT ALL ON public.place_owners TO service_role;
ALTER TABLE public.place_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_owners public read verified" ON public.place_owners
  FOR SELECT USING (verified = true);
CREATE POLICY "place_owners owner read own" ON public.place_owners
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "place_owners admin read" ON public.place_owners
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "place_owners admin write" ON public.place_owners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER place_owners_set_updated_at BEFORE UPDATE ON public.place_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: is verified owner of place
CREATE OR REPLACE FUNCTION public.is_place_owner(_user_id uuid, _place_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.place_owners
    WHERE user_id = _user_id AND place_id = _place_id AND verified = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verified_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.place_owners WHERE user_id = _user_id AND verified = true
  );
$$;

-- 2) owner_requests
CREATE TABLE public.owner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  instagram_url text,
  website_url text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_requests_status_idx ON public.owner_requests(status, created_at DESC);
CREATE INDEX owner_requests_place_idx ON public.owner_requests(place_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_requests TO authenticated;
GRANT ALL ON public.owner_requests TO service_role;
ALTER TABLE public.owner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_requests insert authenticated" ON public.owner_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "owner_requests read own" ON public.owner_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_requests admin all" ON public.owner_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER owner_requests_set_updated_at BEFORE UPDATE ON public.owner_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- notify super_admin on new request
CREATE OR REPLACE FUNCTION public.owner_requests_notify_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_place text; v_slug text; v_admin uuid;
BEGIN
  SELECT name, slug INTO v_place, v_slug FROM public.places WHERE id = NEW.place_id;
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','super_admin') LOOP
    PERFORM public.notify(
      v_admin, 'owner_request',
      'Nowe zgloszenie wlasciciela',
      NEW.name || ' zglasza sie jako wlasciciel ' || COALESCE(v_place, ''),
      '/admin/owner-requests',
      'owner_request', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_requests_notify_admin_ins AFTER INSERT ON public.owner_requests
  FOR EACH ROW EXECUTE FUNCTION public.owner_requests_notify_admin();

-- 3) place_follows
CREATE TABLE public.place_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);
CREATE INDEX place_follows_place_idx ON public.place_follows(place_id);
CREATE INDEX place_follows_user_idx ON public.place_follows(user_id);
GRANT SELECT ON public.place_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.place_follows TO authenticated;
GRANT ALL ON public.place_follows TO service_role;
ALTER TABLE public.place_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_follows public read" ON public.place_follows FOR SELECT USING (true);
CREATE POLICY "place_follows insert own" ON public.place_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "place_follows delete own" ON public.place_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notify owner on new follow
CREATE OR REPLACE FUNCTION public.place_follows_notify_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_slug text; v_who text;
BEGIN
  SELECT user_id INTO v_owner FROM public.place_owners WHERE place_id = NEW.place_id AND verified = true;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT name, slug INTO v_name, v_slug FROM public.places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'place_follow', 'Nowy obserwujacy',
    v_who || ' obserwuje ' || COALESCE(v_name, ''),
    '/k/' || COALESCE(v_slug, ''), 'place', NEW.place_id);
  RETURN NEW;
END $$;
CREATE TRIGGER place_follows_notify_owner_ins AFTER INSERT ON public.place_follows
  FOR EACH ROW EXECUTE FUNCTION public.place_follows_notify_owner();

-- notify owner on favorite
CREATE OR REPLACE FUNCTION public.place_favorites_notify_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_slug text; v_who text;
BEGIN
  SELECT user_id INTO v_owner FROM public.place_owners WHERE place_id = NEW.place_id AND verified = true;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT name, slug INTO v_name, v_slug FROM public.places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'place_favorite', 'Dodano do ulubionych',
    v_who || ' dodal(a) do ulubionych ' || COALESCE(v_name, ''),
    '/k/' || COALESCE(v_slug, ''), 'place', NEW.place_id);
  RETURN NEW;
END $$;
CREATE TRIGGER place_favorites_notify_owner_ins AFTER INSERT ON public.place_favorites
  FOR EACH ROW EXECUTE FUNCTION public.place_favorites_notify_owner();

-- notify owner on new review
CREATE OR REPLACE FUNCTION public.reviews_notify_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_slug text; v_who text;
BEGIN
  SELECT user_id INTO v_owner FROM public.place_owners WHERE place_id = NEW.place_id AND verified = true;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT name, slug INTO v_name, v_slug FROM public.places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'review_new', 'Nowa recenzja Twojej knajpy',
    v_who || ' ocenil(a) ' || COALESCE(v_name, '') || ' na ' || NEW.rating || '/5',
    '/k/' || COALESCE(v_slug, ''), 'review', NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER reviews_notify_owner_ins AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_notify_owner();

-- 4) review_replies
CREATE TABLE public.review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);
CREATE INDEX review_replies_review_idx ON public.review_replies(review_id);
GRANT SELECT ON public.review_replies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT ALL ON public.review_replies TO service_role;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_replies public read" ON public.review_replies FOR SELECT USING (true);
CREATE POLICY "review_replies owner insert" ON public.review_replies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.is_place_owner(auth.uid(), place_id));
CREATE POLICY "review_replies owner update" ON public.review_replies
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "review_replies owner delete" ON public.review_replies
  FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER review_replies_set_updated_at BEFORE UPDATE ON public.review_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- notify review author when owner replies
CREATE OR REPLACE FUNCTION public.review_replies_notify_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid; v_name text; v_slug text;
BEGIN
  SELECT r.user_id, pl.name, pl.slug INTO v_author, v_name, v_slug
    FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id WHERE r.id = NEW.review_id;
  IF v_author IS NULL OR v_author = NEW.owner_id THEN RETURN NEW; END IF;
  PERFORM public.notify(v_author, 'review_reply', 'Wlasciciel odpowiedzial',
    'Wlasciciel ' || COALESCE(v_name, '') || ' odpowiedzial na Twoja recenzje',
    '/k/' || COALESCE(v_slug, ''), 'review', NEW.review_id);
  RETURN NEW;
END $$;
CREATE TRIGGER review_replies_notify_ins AFTER INSERT ON public.review_replies
  FOR EACH ROW EXECUTE FUNCTION public.review_replies_notify_author();

-- 5) rozszerzenie place_posts + polityki dla ownera
ALTER TABLE public.place_posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'announcement'
    CHECK (post_type IN ('promotion','event','new_menu','announcement')),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE POLICY "place_posts owner insert" ON public.place_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.is_place_owner(auth.uid(), place_id));
CREATE POLICY "place_posts owner update" ON public.place_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND public.is_place_owner(auth.uid(), place_id))
  WITH CHECK (auth.uid() = owner_id AND public.is_place_owner(auth.uid(), place_id));
CREATE POLICY "place_posts owner delete" ON public.place_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id AND public.is_place_owner(auth.uid(), place_id));

-- 6) place_post_reactions
CREATE TABLE public.place_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.place_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('fire','heart','yum')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type)
);
CREATE INDEX place_post_reactions_post_idx ON public.place_post_reactions(post_id);
GRANT SELECT ON public.place_post_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.place_post_reactions TO authenticated;
GRANT ALL ON public.place_post_reactions TO service_role;
ALTER TABLE public.place_post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_reactions public read" ON public.place_post_reactions FOR SELECT USING (true);
CREATE POLICY "post_reactions insert own" ON public.place_post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_reactions delete own" ON public.place_post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notify post owner on reaction
CREATE OR REPLACE FUNCTION public.place_post_reactions_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_slug text; v_who text;
BEGIN
  SELECT pp.owner_id, pl.slug INTO v_owner, v_slug
    FROM public.place_posts pp LEFT JOIN public.places pl ON pl.id = pp.place_id
    WHERE pp.id = NEW.post_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'post_reaction', 'Nowa reakcja na Twoj post',
    v_who || ' zareagowal(a) na Twoj post',
    '/k/' || COALESCE(v_slug, ''), 'place_post', NEW.post_id);
  RETURN NEW;
END $$;
CREATE TRIGGER place_post_reactions_notify_ins AFTER INSERT ON public.place_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.place_post_reactions_notify();

-- 7) place_post_comments
CREATE TABLE public.place_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.place_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX place_post_comments_post_idx ON public.place_post_comments(post_id, created_at DESC);
GRANT SELECT ON public.place_post_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.place_post_comments TO authenticated;
GRANT ALL ON public.place_post_comments TO service_role;
ALTER TABLE public.place_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_comments public read" ON public.place_post_comments FOR SELECT USING (true);
CREATE POLICY "post_comments insert own" ON public.place_post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_comments delete own or owner" ON public.place_post_comments
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.place_posts pp WHERE pp.id = post_id AND pp.owner_id = auth.uid())
  );

-- notify post owner on comment
CREATE OR REPLACE FUNCTION public.place_post_comments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_slug text; v_who text;
BEGIN
  SELECT pp.owner_id, pl.slug INTO v_owner, v_slug
    FROM public.place_posts pp LEFT JOIN public.places pl ON pl.id = pp.place_id
    WHERE pp.id = NEW.post_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Ktos') INTO v_who FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify(v_owner, 'post_comment', 'Nowy komentarz do Twojego postu',
    v_who || ' skomentowal(a) Twoj post',
    '/k/' || COALESCE(v_slug, ''), 'place_post', NEW.post_id);
  RETURN NEW;
END $$;
CREATE TRIGGER place_post_comments_notify_ins AFTER INSERT ON public.place_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.place_post_comments_notify();

-- 8) rozszerzenie places o edycje przez ownera (ograniczone kolumny w server fn)
CREATE POLICY "places owner update" ON public.places
  FOR UPDATE TO authenticated
  USING (public.is_place_owner(auth.uid(), id))
  WITH CHECK (public.is_place_owner(auth.uid(), id));

