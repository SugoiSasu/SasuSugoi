-- FILE: 20260618105627_911304d3-232a-4a42-a308-5fa6d23b1891.sql

-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Places
CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  address TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  reel_url TEXT,
  cover_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places public read" ON public.places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "places admin insert" ON public.places FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "places admin update" ON public.places FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "places admin delete" ON public.places FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER places_updated_at BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blog posts
CREATE TYPE public.post_status AS ENUM ('draft', 'published');

CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_md TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status post_status NOT NULL DEFAULT 'draft',
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog public read published" ON public.blog_posts FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "blog admin read all" ON public.blog_posts FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "blog admin insert" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "blog admin update" ON public.blog_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "blog admin delete" ON public.blog_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX blog_posts_status_published_at_idx ON public.blog_posts (status, published_at DESC);

-- FILE: 20260618105702_a0c45bd2-70fd-438b-95ce-ea53e4fa7b6c.sql

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;

-- FILE: 20260618105749_688c8fac-0731-4613-b9ce-426dcd713261.sql

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_any_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_any_admin;
  IF has_any_admin THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- FILE: 20260618113530_19bfe4d4-80d7-4fb9-b298-bf6c406d24a0.sql
-- Rozszerzenie tabeli profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Username musi być unikalny i pasować do formatu
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 500);

-- Trigger updated_at
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Publiczny odczyt profilu (tylko podstawowe pola — komponowane przez widok lub aplikację)
-- Każdy zalogowany może widzieć profile publiczne; własny zawsze widoczny
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
CREATE POLICY "public profiles readable"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (is_public = TRUE OR auth.uid() = id);

-- Grant na anon (do publicznego profilu /u/$username)
GRANT SELECT ON public.profiles TO anon;

-- Pozwól użytkownikowi wstawić własny profil (na wypadek gdyby trigger nie zadziałał)
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- FILE: 20260618113607_37784569-fa54-4e6f-9ef5-d95330432c3f.sql
-- Avatars storage policies
-- Path convention: <user_id>/<filename>

CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars users upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars users update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars users delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- FILE: 20260619080523_25b26509-0dc3-49fb-a469-899f6266ecb2.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- FILE: 20260619080541_5040e789-d508-4b5c-ac5d-ce2479edd393.sql
-- Promote existing admins to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role
FROM public.user_roles
WHERE role = 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;

-- Helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
$$;

CREATE POLICY "super_admin reads all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super_admin inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admin deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super_admin reads all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin());

-- FILE: 20260620101651_14ed22c4-ebd4-4bd8-a419-9b694690bd15.sql
-- Social media accounts (brand-level, super_admin only)
CREATE TYPE public.social_platform AS ENUM ('instagram', 'tiktok', 'youtube', 'facebook');

CREATE TABLE public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform public.social_platform NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  profile_url TEXT,
  followers_count BIGINT,
  posts_count BIGINT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Publicznie widoczne (liczniki na home/stopce)
CREATE POLICY "Public can read active social accounts"
  ON public.social_accounts FOR SELECT
  USING (is_active = TRUE);

-- Tylko super_admin zarządza
CREATE POLICY "Super admin can insert social accounts"
  ON public.social_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update social accounts"
  ON public.social_accounts FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete social accounts"
  ON public.social_accounts FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FILE: 20260623123210_d088540a-1c5e-4f27-ad72-37f8d6dd571f.sql

-- 1. Lock down public exposure of social_accounts to safe columns via a view
DROP POLICY IF EXISTS "Public can read active social accounts" ON public.social_accounts;

CREATE OR REPLACE VIEW public.social_accounts_public
WITH (security_invoker = true)
AS
SELECT platform, handle, profile_url, followers_count, posts_count, is_active
FROM public.social_accounts
WHERE is_active = true;

GRANT SELECT ON public.social_accounts_public TO anon, authenticated;

-- Allow super-admins to still read the full table via the API
CREATE POLICY "Super admin can read social accounts"
ON public.social_accounts FOR SELECT TO authenticated
USING (public.is_super_admin());

REVOKE SELECT ON public.social_accounts FROM anon;

-- 2. Lock down SECURITY DEFINER function execution to the roles that need them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- handle_new_user is invoked by a trigger on auth.users — no role grants needed

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- 3. Restrict avatars bucket read access — clients fetch via signed URLs anyway
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars users read own"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- FILE: 20260623123318_216f9e3c-4933-4e56-bb59-dc8037bd38ca.sql

-- ============================================================
-- 1. Recreate every policy that referenced has_role/is_super_admin
--    with inline EXISTS checks, so we can drop the helper funcs.
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "super_admin reads all profiles" ON public.profiles;
CREATE POLICY "super_admin reads all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- user_roles
DROP POLICY IF EXISTS "super_admin deletes roles" ON public.user_roles;
CREATE POLICY "super_admin deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
));

DROP POLICY IF EXISTS "super_admin inserts roles" ON public.user_roles;
-- Replacement: super_admin OR first-admin self-claim when no admin exists yet
CREATE POLICY "super_admin or first admin claim inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
  OR (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  )
);

DROP POLICY IF EXISTS "super_admin reads all roles" ON public.user_roles;
CREATE POLICY "super_admin reads all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
));

-- places
DROP POLICY IF EXISTS "places admin delete" ON public.places;
CREATE POLICY "places admin delete"
ON public.places FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "places admin insert" ON public.places;
CREATE POLICY "places admin insert"
ON public.places FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "places admin update" ON public.places;
CREATE POLICY "places admin update"
ON public.places FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- blog_posts
DROP POLICY IF EXISTS "blog admin delete" ON public.blog_posts;
CREATE POLICY "blog admin delete"
ON public.blog_posts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "blog admin insert" ON public.blog_posts;
CREATE POLICY "blog admin insert"
ON public.blog_posts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "blog admin read all" ON public.blog_posts;
CREATE POLICY "blog admin read all"
ON public.blog_posts FOR SELECT TO authenticated
USING (
  status = 'published'::post_status
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "blog admin update" ON public.blog_posts;
CREATE POLICY "blog admin update"
ON public.blog_posts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- social_accounts (rebuild every policy that referenced is_super_admin)
DROP POLICY IF EXISTS "Super admin can read social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can read social accounts"
ON public.social_accounts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can delete social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can delete social accounts"
ON public.social_accounts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can insert social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can insert social accounts"
ON public.social_accounts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

DROP POLICY IF EXISTS "Super admin can update social accounts" ON public.social_accounts;
CREATE POLICY "Super admin can update social accounts"
ON public.social_accounts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- ============================================================
-- 2. Drop the no-longer-referenced SECURITY DEFINER helpers
-- ============================================================
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.claim_first_admin();

-- ============================================================
-- 3. Lock down handle_new_user — only the trigger needs it
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- FILE: 20260623125243_161cefe2-c07f-4231-b7d2-aea2ad70a1c2.sql
CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blog_comments_post_id_idx ON public.blog_comments(post_id, created_at DESC);

GRANT SELECT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments public read on published"
ON public.blog_comments FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.blog_posts bp
  WHERE bp.id = blog_comments.post_id AND bp.status = 'published'
));

CREATE POLICY "users insert own comments"
ON public.blog_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own comments"
ON public.blog_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own comments"
ON public.blog_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins moderate comments"
ON public.blog_comments FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
));

CREATE TRIGGER blog_comments_set_updated_at
BEFORE UPDATE ON public.blog_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FILE: 20260623125304_b3eb7ee1-37d8-41f3-9b03-00cb27776af3.sql
CREATE POLICY "blog images public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-images');

CREATE POLICY "blog images admin write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE POLICY "blog images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE POLICY "blog images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-images' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

-- FILE: 20260623130308_31f01212-86d9-4309-9245-ea8d243be331.sql
CREATE TABLE public.place_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  label text,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.place_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_locations TO authenticated;
GRANT ALL ON public.place_locations TO service_role;

ALTER TABLE public.place_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_locations public read"
  ON public.place_locations FOR SELECT
  USING (true);

CREATE POLICY "place_locations admin insert"
  ON public.place_locations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE POLICY "place_locations admin update"
  ON public.place_locations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE POLICY "place_locations admin delete"
  ON public.place_locations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE INDEX place_locations_place_id_idx ON public.place_locations(place_id);

CREATE TRIGGER place_locations_set_updated_at
  BEFORE UPDATE ON public.place_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FILE: 20260623130605_5a1839cd-35d6-4ad6-b198-ce92a4a65a2c.sql
-- 1. Tighten user_roles INSERT: only super_admin can grant roles
DROP POLICY IF EXISTS "super_admin or first admin claim inserts roles" ON public.user_roles;

CREATE POLICY "super_admin inserts roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  );

-- 2. Restrict avatars read policy to authenticated owners only
DROP POLICY IF EXISTS "avatars users read own" ON storage.objects;

CREATE POLICY "avatars users read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- FILE: 20260623131828_d5935529-c646-4075-bdf2-aa830cf11f78.sql
-- 1. Add avatar_source column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_source text NOT NULL DEFAULT 'initials'
    CHECK (avatar_source IN ('initials','google','upload'));

-- 2. Backfill: rows with avatar_url assumed to be uploads unless URL is googleusercontent
UPDATE public.profiles
SET avatar_source = CASE
  WHEN avatar_url IS NULL THEN 'initials'
  WHEN avatar_url LIKE '%googleusercontent.com%' THEN 'google'
  ELSE 'upload'
END
WHERE avatar_source = 'initials';

-- 3. Improve handle_new_user to pull Google avatar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avatar text;
  v_source text := 'initials';
BEGIN
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  IF v_avatar IS NOT NULL THEN
    v_source := 'google';
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    v_avatar,
    v_source
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Re-create UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- FILE: 20260623131854_de23fd3f-0798-46b3-bdee-7e9f162e8f1f.sql
CREATE TABLE public.ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]{2,30}$'),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#e35d2e',
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranks TO authenticated;
GRANT ALL ON public.ranks TO service_role;

ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ranks public read" ON public.ranks FOR SELECT USING (true);
CREATE POLICY "ranks super_admin insert" ON public.ranks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "ranks super_admin update" ON public.ranks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "ranks super_admin delete" ON public.ranks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role)
    AND is_system = false
  );

CREATE TRIGGER ranks_set_updated_at BEFORE UPDATE ON public.ranks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.user_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank_id uuid NOT NULL REFERENCES public.ranks(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rank_id)
);

GRANT SELECT ON public.user_ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ranks TO authenticated;
GRANT ALL ON public.user_ranks TO service_role;

ALTER TABLE public.user_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ranks public read" ON public.user_ranks FOR SELECT USING (true);
CREATE POLICY "user_ranks super_admin insert" ON public.user_ranks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));
CREATE POLICY "user_ranks super_admin delete" ON public.user_ranks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));

CREATE INDEX user_ranks_user_id_idx ON public.user_ranks(user_id);

-- Seed system rank "pożeramy" and assign to Head Admin (Mateusz)
INSERT INTO public.ranks (slug, name, color, icon, description, sort_order, is_system)
VALUES ('pozeramy', 'pożeramy', '#e35d2e', '🍕', 'Head Admin i właściciel platformy', 0, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_ranks (user_id, rank_id, granted_by)
SELECT '89e4e471-4931-43b9-8622-f0bfa5718c73'::uuid, r.id, '89e4e471-4931-43b9-8622-f0bfa5718c73'::uuid
FROM public.ranks r WHERE r.slug = 'pozeramy'
ON CONFLICT DO NOTHING;

-- FILE: 20260623131928_ef6a2579-bc49-4327-a92b-f580ade6e014.sql
-- Add points_total to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points_total integer NOT NULL DEFAULT 0;

-- 1. reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (body IS NULL OR length(body) <= 2000),
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews owner insert" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews owner update" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews owner delete" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE INDEX reviews_place_id_idx ON public.reviews(place_id);
CREATE INDEX reviews_user_id_idx ON public.reviews(user_id);

CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. points_rules (configurable)
CREATE TABLE public.points_rules (
  event_key text PRIMARY KEY,
  points integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.points_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.points_rules TO authenticated;
GRANT ALL ON public.points_rules TO service_role;

ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_rules public read" ON public.points_rules FOR SELECT USING (true);
CREATE POLICY "points_rules admin write" ON public.points_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

INSERT INTO public.points_rules (event_key, points, description) VALUES
  ('review_created',       10, 'Za dodanie recenzji (raz na lokal)'),
  ('review_with_photo',     5, 'Bonus za załączenie zdjęcia do recenzji'),
  ('first_visit_new_place',20, 'Bonus za pierwszą recenzję w nowym lokalu')
ON CONFLICT DO NOTHING;

-- 3. points_transactions (audit + reversible)
CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  points integer NOT NULL,
  ref_type text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_tx owner read" ON public.points_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE INDEX points_tx_user_idx ON public.points_transactions(user_id);

-- 4. helper: award points (security definer; called from triggers)
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid, _event_key text, _ref_type text, _ref_id uuid, _multiplier int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pts int;
BEGIN
  SELECT points INTO v_pts FROM public.points_rules WHERE event_key = _event_key AND enabled = true;
  IF v_pts IS NULL THEN RETURN; END IF;
  v_pts := v_pts * _multiplier;
  INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
  VALUES (_user_id, _event_key, v_pts, _ref_type, _ref_id);
  UPDATE public.profiles SET points_total = points_total + v_pts WHERE id = _user_id;
END;
$$;

-- 5. triggers on reviews
CREATE OR REPLACE FUNCTION public.reviews_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first_visit boolean;
BEGIN
  PERFORM public.award_points(NEW.user_id, 'review_created', 'review', NEW.id);
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
    PERFORM public.award_points(NEW.user_id, 'review_with_photo', 'review', NEW.id);
  END IF;
  -- first visit = no prior review by this user for this place (we just inserted, so check =1)
  SELECT (count(*) = 1) INTO v_first_visit
  FROM public.reviews WHERE user_id = NEW.user_id AND place_id = NEW.place_id;
  IF v_first_visit THEN
    PERFORM public.award_points(NEW.user_id, 'first_visit_new_place', 'review', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_reverse_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sum int;
BEGIN
  SELECT COALESCE(sum(points),0) INTO v_sum
  FROM public.points_transactions
  WHERE ref_type = 'review' AND ref_id = OLD.id;

  IF v_sum <> 0 THEN
    INSERT INTO public.points_transactions (user_id, event_key, points, ref_type, ref_id)
    VALUES (OLD.user_id, 'review_deleted', -v_sum, 'review', OLD.id);
    UPDATE public.profiles SET points_total = points_total - v_sum WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER reviews_award_after_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_award_on_insert();

CREATE TRIGGER reviews_reverse_after_delete
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_reverse_on_delete();

-- FILE: 20260623131941_37af3a5c-114d-4634-80ce-4747c9b31c67.sql
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, text, uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_reverse_on_delete() FROM PUBLIC, anon, authenticated;

-- FILE: 20260623131957_d1d97e14-e25a-41b2-b0a2-58b87ffaf549.sql
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

-- FILE: 20260623132032_4ba09b52-27ea-4fce-aca4-2f9b32355356.sql
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]{2,40}$'),
  name text NOT NULL,
  description text,
  icon_url text,
  criteria jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.achievements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "achievements admin write" ON public.achievements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));

CREATE TRIGGER achievements_set_updated_at BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT ALL ON public.user_achievements TO service_role;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements public read" ON public.user_achievements FOR SELECT USING (true);

CREATE INDEX user_achievements_user_idx ON public.user_achievements(user_id);

-- Seed a few defaults
INSERT INTO public.achievements (slug, name, description, criteria, sort_order) VALUES
  ('first_bite',      'Pierwszy gryz',       'Dodaj pierwszą recenzję',                  '{"type":"reviews_count","threshold":1}'::jsonb, 1),
  ('local_explorer',  'Lokalny zwiadowca',   'Odwiedź 5 różnych lokali',                 '{"type":"unique_places","threshold":5}'::jsonb, 2),
  ('food_critic',     'Krytyk kulinarny',    'Dodaj 10 recenzji',                        '{"type":"reviews_count","threshold":10}'::jsonb, 3),
  ('hundred_club',    'Klub Setki',          'Zdobądź 100 punktów PoŻarcia',             '{"type":"points_total","threshold":100}'::jsonb, 4),
  ('social_butterfly','Społeczny żarłok',    'Miej 5 znajomych',                         '{"type":"friends_count","threshold":5}'::jsonb, 5)
ON CONFLICT DO NOTHING;

-- Engine: check_achievements(user_id) — INVOKER so callable from triggers + RPC
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
BEGIN
  FOR r IN SELECT id, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := r.criteria->>'type';
    v_threshold := (r.criteria->>'threshold')::int;
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, r.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;

-- Hook check_achievements into the existing review trigger
CREATE OR REPLACE FUNCTION public.reviews_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first_visit boolean;
BEGIN
  PERFORM public.award_points(NEW.user_id, 'review_created', 'review', NEW.id);
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
    PERFORM public.award_points(NEW.user_id, 'review_with_photo', 'review', NEW.id);
  END IF;
  SELECT (count(*) = 1) INTO v_first_visit
  FROM public.reviews WHERE user_id = NEW.user_id AND place_id = NEW.place_id;
  IF v_first_visit THEN
    PERFORM public.award_points(NEW.user_id, 'first_visit_new_place', 'review', NEW.id);
  END IF;
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;

-- Trigger on friendships acceptance: recheck both users' achievements
CREATE OR REPLACE FUNCTION public.friendships_check_achievements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.check_achievements(NEW.requester_id);
    PERFORM public.check_achievements(NEW.addressee_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.friendships_check_achievements() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER friendships_achievements_after_update
  AFTER UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_check_achievements();

-- FILE: 20260623132103_fa15eebc-4d65-48f7-9fd3-d735065323c7.sql
-- review-photos: anyone can read (community photos), only owner uploads/manages
CREATE POLICY "review-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

CREATE POLICY "review-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "review-photos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "review-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)))
  );

-- achievement-icons: anyone can read, only admins write
CREATE POLICY "achievement-icons public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-icons');

CREATE POLICY "achievement-icons admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

CREATE POLICY "achievement-icons admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

CREATE POLICY "achievement-icons admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'achievement-icons'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role))
  );

-- FILE: 20260623140034_70a21de7-4069-4f87-b40c-9996dd0b4b31.sql

-- Security-definer helper to break RLS recursion on user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- Replace recursive policies on user_roles
DROP POLICY IF EXISTS "super_admin reads all roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin deletes roles" ON public.user_roles;

CREATE POLICY "super_admin reads all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin inserts roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin updates roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin deletes roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Clean up profiles policy that inlined the same EXISTS (no recursion there, but normalize via has_role)
DROP POLICY IF EXISTS "super_admin reads all profiles" ON public.profiles;
CREATE POLICY "super_admin reads all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- FILE: 20260623140245_aca852c8-c55e-4352-b667-c861f67fb689.sql

-- 1) Revoke broad EXECUTE on SECURITY DEFINER functions, then grant only what's needed.
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.friendships_check_achievements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_reverse_on_delete() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

REVOKE EXECUTE ON FUNCTION public.get_friends_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_count(uuid) TO authenticated, anon, service_role;

-- 2) Restrict user_achievements / user_ranks read to authenticated.
DROP POLICY IF EXISTS "user_achievements public read" ON public.user_achievements;
CREATE POLICY "user_achievements authenticated read" ON public.user_achievements
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_ranks public read" ON public.user_ranks;
CREATE POLICY "user_ranks authenticated read" ON public.user_ranks
FOR SELECT TO authenticated USING (true);

-- 3) Allow public read of avatar images so other users can see profile pictures.
CREATE POLICY "avatars public read" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');

-- FILE: 20260623141542_be101254-fd39-4487-a80a-7fceda895382.sql
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS menu_url text,
  ADD COLUMN IF NOT EXISTS menu_image_url text;

-- FILE: 20260623150850_d4ecb39a-d07a-4aec-b672-45171bad7bcb.sql

CREATE TABLE public.place_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

GRANT SELECT, INSERT, DELETE ON public.place_favorites TO authenticated;
GRANT SELECT ON public.place_favorites TO anon;
GRANT ALL ON public.place_favorites TO service_role;

ALTER TABLE public.place_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view favorites"
  ON public.place_favorites FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own favorites"
  ON public.place_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.place_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_place_favorites_user ON public.place_favorites(user_id);
CREATE INDEX idx_place_favorites_place ON public.place_favorites(place_id);

-- FILE: 20260623152925_3c88588d-e827-4365-ae5a-92749faa79ca.sql
-- 1) place_posts
CREATE TABLE public.place_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  image_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.place_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.place_posts TO authenticated;
GRANT ALL ON public.place_posts TO service_role;
ALTER TABLE public.place_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_posts read all" ON public.place_posts FOR SELECT USING (true);
CREATE POLICY "place_posts admin insert" ON public.place_posts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "place_posts admin update" ON public.place_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "place_posts admin delete" ON public.place_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER place_posts_set_updated_at BEFORE UPDATE ON public.place_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX place_posts_place_id_idx ON public.place_posts(place_id);
CREATE INDEX place_posts_created_at_idx ON public.place_posts(created_at DESC);

-- 2) ads
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  message text NOT NULL,
  link_url text,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads read all" ON public.ads FOR SELECT USING (true);
CREATE POLICY "ads super insert" ON public.ads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "ads super update" ON public.ads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "ads super delete" ON public.ads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER ads_set_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ads_active_idx ON public.ads(active);

-- 3) search_users: returns profiles whose username, display_name or email match
CREATE OR REPLACE FUNCTION public.search_users(_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_source text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.avatar_source::text
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE length(coalesce(_query, '')) >= 2
    AND (
      p.username ILIKE '%' || _query || '%'
      OR p.display_name ILIKE '%' || _query || '%'
      OR u.email ILIKE '%' || _query || '%'
    )
  LIMIT 25;
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- FILE: 20260623152938_cb9bd3fb-0846-4102-8a45-6689c3f6b9bb.sql
REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- FILE: 20260623153544_d0d63558-bfd6-4aee-a9fb-1fa131fb15ce.sql
-- 1) Places slug
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(_input, ''),
            'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
            'acelnoszzacelnoszz'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

-- Backfill, with collision suffix
DO $$
DECLARE r record; base text; candidate text; i int;
BEGIN
  FOR r IN SELECT id, name FROM public.places WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base IS NULL OR base = '' THEN base := 'lokal'; END IF;
    candidate := base; i := 1;
    WHILE EXISTS (SELECT 1 FROM public.places WHERE slug = candidate AND id <> r.id) LOOP
      i := i + 1; candidate := base || '-' || i;
    END LOOP;
    UPDATE public.places SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.places ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS places_slug_unique ON public.places(slug);

CREATE OR REPLACE FUNCTION public.places_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE base text; candidate text; i int;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.slugify(NEW.name);
    IF base IS NULL OR base = '' THEN base := 'lokal'; END IF;
    candidate := base; i := 1;
    WHILE EXISTS (SELECT 1 FROM public.places WHERE slug = candidate AND id <> NEW.id) LOOP
      i := i + 1; candidate := base || '-' || i;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS places_set_slug_trg ON public.places;
CREATE TRIGGER places_set_slug_trg BEFORE INSERT OR UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.places_set_slug();

-- 2) Profile social links
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url    text,
  ADD COLUMN IF NOT EXISTS youtube_url   text,
  ADD COLUMN IF NOT EXISTS facebook_url  text,
  ADD COLUMN IF NOT EXISTS x_url         text;

-- 3) Site settings (alpha gate)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings super manage" ON public.site_settings;
CREATE POLICY "site_settings super manage" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.site_settings(key, value)
VALUES ('alpha_gate', jsonb_build_object('enabled', false, 'password', 'pozeramy'))
ON CONFLICT (key) DO NOTHING;

-- Public RPC: is the gate enabled? (no password leakage)
CREATE OR REPLACE FUNCTION public.alpha_gate_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false)
  FROM public.site_settings WHERE key = 'alpha_gate';
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_enabled() TO anon, authenticated;

-- Public RPC: verify password
CREATE OR REPLACE FUNCTION public.alpha_gate_verify(_password text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.site_settings
    WHERE key = 'alpha_gate'
      AND COALESCE((value->>'enabled')::boolean, false) = false
  ) OR EXISTS(
    SELECT 1 FROM public.site_settings
    WHERE key = 'alpha_gate'
      AND value->>'password' = _password
  );
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_verify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alpha_gate_verify(text) TO anon, authenticated;

-- Read full settings (head admin only)
CREATE OR REPLACE FUNCTION public.alpha_gate_get()
RETURNS TABLE(enabled boolean, password text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((value->>'enabled')::boolean, false) AS enabled,
    COALESCE(value->>'password', '') AS password
  FROM public.site_settings
  WHERE key = 'alpha_gate'
    AND public.has_role(auth.uid(), 'super_admin');
$$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_get() TO authenticated;

-- Update settings (head admin only)
CREATE OR REPLACE FUNCTION public.alpha_gate_set(_enabled boolean, _password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.site_settings
    SET value = jsonb_build_object('enabled', _enabled, 'password', _password),
        updated_at = now()
  WHERE key = 'alpha_gate';
END $$;
REVOKE EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alpha_gate_set(boolean, text) TO authenticated;

-- FILE: 20260623153555_517244db-e1f9-4ea3-ab71-7a0d89c0478c.sql
ALTER TABLE public.places ALTER COLUMN slug SET DEFAULT '';

-- FILE: 20260623154116_12b2bec5-7195-4bea-b7ba-0ce52ad12363.sql
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

-- FILE: 20260623162922_13978a12-e4e6-426e-b950-8293d6e57c53.sql

-- Ads UPDATE: add WITH CHECK to ensure updates persist for super_admin
DROP POLICY IF EXISTS "ads super update" ON public.ads;
CREATE POLICY "ads super update" ON public.ads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Storage policies for ad-images bucket
DROP POLICY IF EXISTS "ad-images read all" ON storage.objects;
CREATE POLICY "ad-images read all" ON storage.objects
  FOR SELECT USING (bucket_id = 'ad-images');

DROP POLICY IF EXISTS "ad-images super insert" ON storage.objects;
CREATE POLICY "ad-images super insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "ad-images super update" ON storage.objects;
CREATE POLICY "ad-images super update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "ad-images super delete" ON storage.objects;
CREATE POLICY "ad-images super delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ad-images' AND public.has_role(auth.uid(), 'super_admin'));

-- FILE: 20260623165423_64019dbd-ddfe-4688-b2fa-8fdc0430dd75.sql

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

-- FILE: 20260623204128_6c0984f5-e3f4-493e-a46b-21b40cc6080f.sql
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

-- FILE: 20260623215015_6be8bbc9-a5d1-4a39-9c8f-ddffab0acc50.sql
CREATE TYPE public.place_visit_status AS ENUM ('want', 'visited');

CREATE TABLE public.place_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  status public.place_visit_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id, status)
);

CREATE INDEX place_visits_user_status_idx ON public.place_visits (user_id, status);
CREATE INDEX place_visits_place_idx ON public.place_visits (place_id);

GRANT SELECT ON public.place_visits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_visits TO authenticated;
GRANT ALL ON public.place_visits TO service_role;

ALTER TABLE public.place_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_visits public read"
  ON public.place_visits FOR SELECT
  USING (true);

CREATE POLICY "place_visits insert own"
  ON public.place_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "place_visits update own"
  ON public.place_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "place_visits delete own"
  ON public.place_visits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER place_visits_set_updated_at
  BEFORE UPDATE ON public.place_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FILE: 20260623225839_6ffcbb19-6d3a-40a8-b7ae-dbb6e2cc9fe3.sql

-- 1) Naprawa Data API GRANTs dla tabeli ads (brakowały, stąd "Failed to fetch")
GRANT SELECT ON public.ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;

-- 2) Tabela zdarzeń reklamowych: wyświetlenia i kliknięcia
CREATE TABLE IF NOT EXISTS public.ad_events (
  id bigserial PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_events_ad_kind_idx ON public.ad_events (ad_id, kind);
CREATE INDEX IF NOT EXISTS ad_events_created_at_idx ON public.ad_events (created_at DESC);

GRANT SELECT, INSERT ON public.ad_events TO anon;
GRANT SELECT, INSERT ON public.ad_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ad_events_id_seq TO anon, authenticated;
GRANT ALL ON public.ad_events TO service_role;
GRANT ALL ON SEQUENCE public.ad_events_id_seq TO service_role;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

-- Każdy (także anonim) może wstawić zdarzenie — tylko impression/click, nic więcej
CREATE POLICY "ad_events insert any"
  ON public.ad_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (kind IN ('impression','click'));

-- Tylko super_admin czyta surowe zdarzenia
CREATE POLICY "ad_events super read"
  ON public.ad_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) Agregat statystyk dostępny dla super_admin
CREATE OR REPLACE FUNCTION public.ad_stats()
RETURNS TABLE (
  ad_id uuid,
  impressions bigint,
  clicks bigint,
  impressions_7d bigint,
  clicks_7d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS ad_id,
    COUNT(*) FILTER (WHERE e.kind = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE e.kind = 'click') AS clicks,
    COUNT(*) FILTER (WHERE e.kind = 'impression' AND e.created_at > now() - interval '7 days') AS impressions_7d,
    COUNT(*) FILTER (WHERE e.kind = 'click' AND e.created_at > now() - interval '7 days') AS clicks_7d
  FROM public.ads a
  LEFT JOIN public.ad_events e ON e.ad_id = a.id
  WHERE public.has_role(auth.uid(), 'super_admin')
  GROUP BY a.id;
$$;

GRANT EXECUTE ON FUNCTION public.ad_stats() TO authenticated;

-- FILE: 20260623235000_fcc5e1dc-5861-4fb4-9e7f-f0e51561db45.sql
CREATE TABLE public.collab_submissions (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  email text not null,
  message text not null,
  consent_version text not null,
  consent_accepted_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now(),
  CONSTRAINT collab_consent_required CHECK (
    consent_version IS NOT NULL AND length(consent_version) > 0 AND consent_accepted_at IS NOT NULL
  ),
  CONSTRAINT collab_brand_len CHECK (char_length(brand) BETWEEN 2 AND 100),
  CONSTRAINT collab_email_len CHECK (char_length(email) BETWEEN 3 AND 200),
  CONSTRAINT collab_message_len CHECK (char_length(message) BETWEEN 10 AND 2000)
);

GRANT INSERT ON public.collab_submissions TO anon, authenticated;
GRANT ALL ON public.collab_submissions TO service_role;

ALTER TABLE public.collab_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit collab with consent"
ON public.collab_submissions FOR INSERT TO anon, authenticated
WITH CHECK (
  consent_version IS NOT NULL AND length(consent_version) > 0 AND consent_accepted_at IS NOT NULL
);

CREATE POLICY "Super admin can read collab submissions"
ON public.collab_submissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_submissions_created_idx ON public.collab_submissions (created_at DESC);

INSERT INTO public.achievements (slug, name, description, icon_url, criteria, enabled, sort_order)
VALUES
  ('ratatouille', 'Ratatouille', 'Kliknij w logo PoŻeramy 67 razy z rzędu', '🐀',
    '{"type":"logo_clicks","threshold":67,"hidden":true}'::jsonb, true, 100),
  ('night_owl', 'Nocny Marek', 'Dodaj recenzję między 23:00 a 3:00 w nocy', '🌙',
    '{"type":"review_at_night","threshold":1}'::jsonb, true, 101),
  ('lens_licker', 'Foodie fotograf', 'Dodaj zdjęcie do 20 różnych recenzji', '📸',
    '{"type":"reviews_with_photo","threshold":20}'::jsonb, true, 102),
  ('hot_streak', 'Passa żarłoka', 'Dodaj recenzję 7 dni z rzędu', '🔥',
    '{"type":"review_streak_days","threshold":7}'::jsonb, true, 103),
  ('district_king', 'Król dzielnicy', 'Zrecenzuj 10 lokali w tej samej dzielnicy', '👑',
    '{"type":"same_district_reviews","threshold":10}'::jsonb, true, 104),
  ('harsh_critic', 'Bez litości', 'Wystaw ocenę 1/5 pięciu różnym lokalom', '🌶️',
    '{"type":"one_star_reviews","threshold":5}'::jsonb, true, 105),
  ('taste_ambassador', 'Ambasador smaku', 'Zaproś 3 znajomych, którzy założą konto', '🤝',
    '{"type":"referrals","threshold":3}'::jsonb, true, 106),
  ('world_eater', 'Świat na talerzu', 'Zrecenzuj lokale 5 różnych kuchni świata', '🥢',
    '{"type":"distinct_cuisines","threshold":5}'::jsonb, true, 107),
  ('beta_tester', 'Szczur laboratoryjny', 'Byłeś z nami od samego początku', '🧪',
    '{"type":"manual","gold":true}'::jsonb, true, 108),
  ('pozaramy_legend', 'Legenda PoŻeramy', 'Zdobądź wszystkie inne achievementy', '🏆',
    '{"type":"all_achievements"}'::jsonb, true, 109)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
BEGIN
  FOR r IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := r.criteria->>'type';
    v_threshold := COALESCE((r.criteria->>'threshold')::int, 1);
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_at_night' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_with_photo' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_streak_days' THEN
      WITH days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM public.reviews WHERE user_id = _user_id
      ),
      grp AS (
        SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days
      ),
      streaks AS (
        SELECT count(*)::int AS len FROM grp GROUP BY g
      )
      SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'one_star_reviews' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND rating = 1;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'distinct_cuisines' THEN
      SELECT count(DISTINCT p.cuisine) INTO v_count
      FROM public.reviews r JOIN public.places p ON p.id = r.place_id
      WHERE r.user_id = _user_id AND p.cuisine IS NOT NULL AND p.cuisine <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'all_achievements' THEN
      SELECT count(*) INTO v_total_other FROM public.achievements
        WHERE enabled = true AND slug <> 'pozaramy_legend';
      SELECT count(*) INTO v_user_other FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
      v_meets := v_total_other > 0 AND v_user_other >= v_total_other;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, r.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- FILE: 20260623235244_dd6fa2c0-73ca-4a1c-87c5-6e37cebcce4a.sql
CREATE TYPE public.collab_status AS ENUM ('new', 'read', 'replied', 'archived');

ALTER TABLE public.collab_submissions
  ADD COLUMN status public.collab_status NOT NULL DEFAULT 'new',
  ADD COLUMN status_updated_at timestamptz,
  ADD COLUMN status_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN admin_notes text;

CREATE POLICY "Super admin can update collab submissions"
ON public.collab_submissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete collab submissions"
ON public.collab_submissions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_submissions_status_idx ON public.collab_submissions (status, created_at DESC);

-- FILE: 20260623235537_719508ce-bcd2-4a3e-8205-b44627b73f00.sql
CREATE TABLE public.collab_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.collab_submissions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_replies_body_len CHECK (char_length(body) BETWEEN 1 AND 10000),
  CONSTRAINT collab_replies_channel_chk CHECK (channel IN ('email','phone','note','other'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_replies TO authenticated;
GRANT ALL ON public.collab_replies TO service_role;

ALTER TABLE public.collab_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read collab replies"
ON public.collab_replies FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can insert collab replies"
ON public.collab_replies FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND author_id = auth.uid());

CREATE POLICY "Super admin can update collab replies"
ON public.collab_replies FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete collab replies"
ON public.collab_replies FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX collab_replies_submission_idx ON public.collab_replies (submission_id, sent_at DESC);

-- FILE: 20260624000736_cc90e2b3-0183-423a-9bf5-4855d85671a0.sql
-- Otwórz publiczny odczyt wszystkich profili — każdy może zobaczyć każdy profil użytkownika
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
DROP POLICY IF EXISTS "own profile read" ON public.profiles;

CREATE POLICY "anyone can read profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.profiles TO anon;

-- FILE: 20260624091819_9d30bba3-d898-498d-a9db-7e45e6434704.sql
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    v_threshold := COALESCE((ach.criteria->>'threshold')::int, 1);
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_at_night' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_with_photo' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_streak_days' THEN
      WITH days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM public.reviews WHERE user_id = _user_id
      ),
      grp AS (
        SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days
      ),
      streaks AS (
        SELECT count(*)::int AS len FROM grp GROUP BY g
      )
      SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'one_star_reviews' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND rating = 1;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'distinct_cuisines' THEN
      SELECT count(DISTINCT pl.cuisine) INTO v_count
      FROM public.reviews rv JOIN public.places pl ON pl.id = rv.place_id
      WHERE rv.user_id = _user_id AND pl.cuisine IS NOT NULL AND pl.cuisine <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'all_achievements' THEN
      SELECT count(*) INTO v_total_other FROM public.achievements
        WHERE enabled = true AND slug <> 'pozaramy_legend';
      SELECT count(*) INTO v_user_other FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
      v_meets := v_total_other > 0 AND v_user_other >= v_total_other;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- FILE: 20260624101151_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- FILE: 20260624112621_2ee13f3c-463e-4902-893c-97855bf084d2.sql

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

-- FILE: 20260630000525_cf43b37e-ec5a-416e-b483-ab77e52e4fb7.sql
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS promo_label text,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.places
  ADD CONSTRAINT places_promo_label_len CHECK (promo_label IS NULL OR char_length(promo_label) <= 100);

-- FILE: 20260702001102_e907f265-554f-4937-9e0e-d968ca2dcbfb.sql

-- 1) Extend places with contact/practical info + structured menu/hours
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS price_range TEXT,
  ADD COLUMN IF NOT EXISTS has_takeaway BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS menu_items JSONB;

-- 2) Cuisines table (admin editable)
CREATE TABLE IF NOT EXISTS public.cuisines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cuisines TO anon, authenticated;
GRANT ALL ON public.cuisines TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.cuisines TO authenticated;
ALTER TABLE public.cuisines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuisines readable by all" ON public.cuisines;
CREATE POLICY "cuisines readable by all" ON public.cuisines FOR SELECT USING (true);
DROP POLICY IF EXISTS "cuisines manageable by super admin" ON public.cuisines;
CREATE POLICY "cuisines manageable by super admin" ON public.cuisines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS cuisines_set_updated_at ON public.cuisines;
CREATE TRIGGER cuisines_set_updated_at
  BEFORE UPDATE ON public.cuisines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cuisines (name, emoji, color, sort_order) VALUES
  ('Włoska',      '🍕', '#3b4cc7', 10),
  ('Amerykańska', '🌭', '#5b6cf0', 20),
  ('Kebaby',      '🌯', '#e26a3a', 30),
  ('Azjatycka',   '🍜', '#d4582a', 40),
  ('Śniadania',   '🍳', '#f0b840', 50),
  ('Słodkości',   '🍦', '#e89aab', 60),
  ('Polska',      '🥟', '#c4416a', 70),
  ('Meksykańska', '🌮', '#3aa56b', 80),
  ('Wegańska',    '🥗', '#3aa56b', 90),
  ('Burgery',     '🍔', '#e35d2e', 100),
  ('Ramen',       '🍲', '#8e5cd9', 110),
  ('Sushi',       '🍣', '#e35d2e', 120),
  ('Mix',         '✨', '#3b4cc7', 999)
ON CONFLICT (name) DO NOTHING;

-- 3) Place suggestions (public form → admin approval)
CREATE TABLE IF NOT EXISTS public.place_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  cuisine TEXT,
  website TEXT,
  instagram TEXT,
  notes TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.place_suggestions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.place_suggestions TO authenticated;
GRANT ALL ON public.place_suggestions TO service_role;
ALTER TABLE public.place_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit suggestion" ON public.place_suggestions;
CREATE POLICY "anyone can submit suggestion" ON public.place_suggestions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "super admin reads suggestions" ON public.place_suggestions;
CREATE POLICY "super admin reads suggestions" ON public.place_suggestions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin updates suggestions" ON public.place_suggestions;
CREATE POLICY "super admin updates suggestions" ON public.place_suggestions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin deletes suggestions" ON public.place_suggestions;
CREATE POLICY "super admin deletes suggestions" ON public.place_suggestions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS place_suggestions_set_updated_at ON public.place_suggestions;
CREATE TRIGGER place_suggestions_set_updated_at
  BEFORE UPDATE ON public.place_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Rating breakdown helper (used by profile stars distribution)
CREATE OR REPLACE FUNCTION public.place_rating_breakdown(_place_id UUID)
RETURNS TABLE(rating INT, count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s AS rating, COALESCE(c.cnt, 0)::bigint AS count
  FROM generate_series(1,5) s
  LEFT JOIN (
    SELECT r.rating::int AS rating, count(*)::bigint AS cnt
    FROM public.reviews r
    WHERE r.place_id = _place_id
    GROUP BY r.rating
  ) c ON c.rating = s
  ORDER BY s DESC;
$$;
GRANT EXECUTE ON FUNCTION public.place_rating_breakdown(UUID) TO anon, authenticated;

-- FILE: 20260707002051_d6409020-119f-466b-a9e7-b5098d380950.sql
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

-- FILE: 20260715001356_d63ed0db-b0ff-4e65-babc-68d2eac63c71.sql
ALTER TABLE public.place_post_reactions DROP CONSTRAINT IF EXISTS place_post_reactions_reaction_type_check;
ALTER TABLE public.place_post_reactions
  ADD CONSTRAINT place_post_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','yum','wow','fire','heart'));

DELETE FROM public.place_post_reactions r
USING public.place_post_reactions r2
WHERE r.post_id = r2.post_id
  AND r.user_id = r2.user_id
  AND r.created_at < r2.created_at;

ALTER TABLE public.place_post_reactions
  DROP CONSTRAINT IF EXISTS place_post_reactions_post_id_user_id_reaction_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS place_post_reactions_post_user_uniq
  ON public.place_post_reactions(post_id, user_id);

GRANT UPDATE ON public.place_post_reactions TO authenticated;

DROP POLICY IF EXISTS "post_reactions update own" ON public.place_post_reactions;
CREATE POLICY "post_reactions update own" ON public.place_post_reactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FILE: 20260715002939_4adb8fce-2c45-47dc-b000-e8da8bc925c5.sql
GRANT SELECT ON public.place_post_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_post_reactions TO authenticated;
GRANT ALL ON public.place_post_reactions TO service_role;

DROP POLICY IF EXISTS "post_reactions public read" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions insert own" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions update own" ON public.place_post_reactions;
DROP POLICY IF EXISTS "post_reactions delete own" ON public.place_post_reactions;

CREATE POLICY "post_reactions public read"
ON public.place_post_reactions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "post_reactions insert own"
ON public.place_post_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions update own"
ON public.place_post_reactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions delete own"
ON public.place_post_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- FILE: 20260716122040_ed59a328-5e0e-49f1-99ef-7c2547e81d44.sql

-- Faza 0: usuń testowy rekord "testing" oraz dodaj flagę publikacji
DELETE FROM public.places WHERE id = '65d22dc8-6ee8-4396-95c7-59d39892a5a6';

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Nowo dodawane lokale trafiają domyślnie do szkiców
ALTER TABLE public.places ALTER COLUMN is_published SET DEFAULT false;

-- Publicznie widoczne tylko opublikowane; admini widzą wszystko (osobna polityka)
DROP POLICY IF EXISTS "places public read" ON public.places;
CREATE POLICY "places public read published"
  ON public.places FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "places admin read all"
  ON public.places FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- FILE: 20260716125739_117b1c14-3673-45c5-a3fd-42bd722d4613.sql

-- Photos gallery for places
CREATE TABLE public.place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.place_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_photos TO authenticated;
GRANT ALL ON public.place_photos TO service_role;

ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view place photos"
  ON public.place_photos FOR SELECT
  USING (true);

CREATE POLICY "Admins and verified owners can insert photos"
  ON public.place_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE POLICY "Admins and verified owners can update photos"
  ON public.place_photos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE POLICY "Admins and verified owners can delete photos"
  ON public.place_photos FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_place_owner(auth.uid(), place_id)
  );

CREATE TRIGGER place_photos_updated_at
  BEFORE UPDATE ON public.place_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX place_photos_place_idx ON public.place_photos(place_id, sort_order);

-- Storage policies on the private place-photos bucket:
-- public read via signed URLs is handled at request time; here we allow authenticated read of metadata
-- and restrict uploads to admins / verified owners.
CREATE POLICY "Public can read place-photos objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-photos');

CREATE POLICY "Admins and owners can upload place-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

CREATE POLICY "Admins and owners can update place-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

CREATE POLICY "Admins and owners can delete place-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.is_verified_owner(auth.uid())
    )
  );

-- FILE: 20260718002450_fac9bb0f-c13a-4f8a-a702-38708358ce15.sql
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS avatar_url text;

-- FILE: 20260723203110_fbbaa595-9fd7-43a1-8815-d761cce87e83.sql

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
      'public.user_blocks_cleanup()',
      'public.email_queue_dispatch()',
      'public.email_queue_wake()'
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

-- FILE: 20260723220055_880b3303-2c06-466d-b3cb-03681bfa3295.sql

-- ============================================
-- 1) Extend check_achievements with new metric types
-- ============================================
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_threshold_bool boolean;
  v_total_other int;
  v_user_other int;
  v_cuisine_pattern text;
  v_has_bool boolean;
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    -- Numeric threshold (default 1). Bool threshold read separately below.
    v_threshold := COALESCE(NULLIF(ach.criteria->>'threshold','true'), NULLIF(ach.criteria->>'threshold','false'), '1')::int;
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_at_night' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'reviews_with_photo' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_streak_days' THEN
      WITH days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM public.reviews WHERE user_id = _user_id
      ),
      grp AS (
        SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days
      ),
      streaks AS (
        SELECT count(*)::int AS len FROM grp GROUP BY g
      )
      SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'one_star_reviews' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND rating = 1;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'distinct_cuisines' THEN
      SELECT count(DISTINCT pl.cuisine) INTO v_count
      FROM public.reviews rv JOIN public.places pl ON pl.id = rv.place_id
      WHERE rv.user_id = _user_id AND pl.cuisine IS NOT NULL AND pl.cuisine <> '';
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'all_achievements' THEN
      SELECT count(*) INTO v_total_other FROM public.achievements
        WHERE enabled = true AND slug <> 'pozaramy_legend';
      SELECT count(*) INTO v_user_other FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
      v_meets := v_total_other > 0 AND v_user_other >= v_total_other;

    -- ===== NEW METRIC TYPES =====

    ELSIF v_type = 'reviews_this_month' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw')
          = date_trunc('month', (now() AT TIME ZONE 'Europe/Warsaw'));
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'first_review_new_place' THEN
      SELECT count(*) INTO v_count
      FROM public.reviews r
      WHERE r.user_id = _user_id
        AND NOT EXISTS (
          SELECT 1 FROM public.reviews r2
          WHERE r2.place_id = r.place_id AND r2.created_at < r.created_at
        );
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'unique_places_in_district' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(DISTINCT r.place_id) AS cnt
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> ''
        GROUP BY pl.district
      ) s;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'unique_districts' THEN
      SELECT count(DISTINCT pl.district) INTO v_count
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> '';
      v_meets := v_count >= v_threshold;

    ELSIF v_type LIKE 'reviews_cuisine_%' THEN
      v_cuisine_pattern := CASE substring(v_type FROM 'reviews_cuisine_(.*)')
        WHEN 'japanese' THEN '(japo|sushi)'
        WHEN 'pizza'    THEN 'pizz'
        WHEN 'kebab'    THEN 'kebab'
        WHEN 'ramen'    THEN 'ramen'
        WHEN 'burger'   THEN 'burger'
        WHEN 'vege'     THEN '(wege|wegań|wegan|vege|vegan)'
        WHEN 'dessert'  THEN '(cukier|lody|lodz|deser|dessert)'
        WHEN 'coffee'   THEN '(kawa|kawiar|coffee|café|cafe)'
        ELSE NULL
      END;
      IF v_cuisine_pattern IS NOT NULL THEN
        SELECT count(*) INTO v_count
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.cuisine ~* v_cuisine_pattern;
        v_meets := v_count >= v_threshold;
      END IF;

    ELSIF v_type = 'reviews_premium' THEN
      SELECT count(*) INTO v_count
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.price_range ~ '\$\$\$\$';
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'ranking_position' THEN
      -- inverse: user_rank <= threshold
      SELECT rnk INTO v_count FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0
      ) s WHERE id = _user_id;
      IF v_count IS NOT NULL THEN
        v_meets := v_count <= v_threshold;
      END IF;

    ELSIF v_type = 'review_likes_max' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.review_reactions rr
        JOIN public.reviews r ON r.id = rr.review_id
        WHERE r.user_id = _user_id
        GROUP BY rr.review_id
      ) s;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_likes_total' THEN
      SELECT count(*) INTO v_count FROM public.review_reactions rr
      JOIN public.reviews r ON r.id = rr.review_id
      WHERE r.user_id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'comments_count' THEN
      SELECT count(*) INTO v_count FROM public.review_comments rc
      JOIN public.reviews r ON r.id = rc.review_id
      WHERE rc.user_id = _user_id AND r.user_id <> _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'referrals_count' THEN
      SELECT count(*) INTO v_count FROM public.friend_invites
      WHERE inviter_id = _user_id AND status = 'accepted';
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_length' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= v_threshold;
      v_meets := v_count >= 1;

    ELSIF v_type = 'long_reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= 300;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_before_9am' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 6 AND 8;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'weekend_reviews' THEN
      SELECT count(DISTINCT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw')) INTO v_count
      FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(ISODOW FROM (created_at AT TIME ZONE 'Europe/Warsaw')) IN (6,7);
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'reviews_lunch_time' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 12 AND 14;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_on_valentines' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 2
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 14;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'review_on_nye' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 12
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 31;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'reviews_same_day' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.reviews
        WHERE user_id = _user_id
        GROUP BY (created_at AT TIME ZONE 'Europe/Warsaw')::date
      ) s;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'early_reviewer_rank' THEN
      -- user is among first N reviewers of a place that has <5 total reviews
      SELECT count(*) INTO v_count FROM (
        SELECT r.place_id,
               row_number() OVER (PARTITION BY r.place_id ORDER BY r.created_at ASC) AS rnk,
               count(*) OVER (PARTITION BY r.place_id) AS total
        FROM public.reviews r
      ) s
      WHERE s.total < 5 AND s.rnk <= v_threshold
        AND EXISTS (SELECT 1 FROM public.reviews rx WHERE rx.place_id = s.place_id AND rx.user_id = _user_id);
      v_meets := v_count >= 1;

    ELSIF v_type = 'profile_completed' THEN
      SELECT (avatar_url IS NOT NULL AND avatar_url <> '' AND bio IS NOT NULL AND length(trim(bio)) > 0)
        INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    -- Metrics without a data source yet — kept as no-op so the badge exists in UI
    -- and will start awarding once the feature ships (challenges, discount codes,
    -- video reviews, beta cohort, app birthday, returned-after-break session tracking).
    ELSIF v_type IN (
      'reviews_with_video',
      'challenges_completed',
      'discount_codes_used',
      'discount_savings_total',
      'returned_after_break',
      'beta_tester',
      'active_on_app_birthday'
    ) THEN
      v_meets := false;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- ============================================
-- 2) Insert 50 new achievements (skip on slug conflict)
-- ============================================
INSERT INTO public.achievements (slug, name, description, icon_url, criteria, sort_order, enabled) VALUES
  ('warming_up','Rozkręcony','Dodaj 25 recenzji','🔥','{"type":"reviews_count","threshold":25}',110,true),
  ('pro_reviewer','Zawodowiec','Dodaj 50 recenzji','🥇','{"type":"reviews_count","threshold":50}',111,true),
  ('pozeramy_legend','Legenda PoŻeramy','Dodaj 250 recenzji','👑','{"type":"reviews_count","threshold":250}',112,true),
  ('reviewer_of_year','Recenzent roku','Dodaj 12 recenzji w jednym miesiącu','📅','{"type":"reviews_this_month","threshold":12}',113,true),
  ('flavor_cartographer','Kartograf smaku','Odwiedź 10 różnych lokali','🗺️','{"type":"unique_places","threshold":10}',120,true),
  ('poznan_magellan','Poznański Magellan','Odwiedź 25 różnych lokali','🧭','{"type":"unique_places","threshold":25}',121,true),
  ('knows_every_corner','Zna każdy kąt','Odwiedź 50 różnych lokali','🏙️','{"type":"unique_places","threshold":50}',122,true),
  ('first_to_arrive','Pierwszy na miejscu','Dodaj pierwszą recenzję nowo dodanego lokalu','🚀','{"type":"first_review_new_place","threshold":1}',123,true),
  ('district_regular','Dzielnicowy ziomek','Odwiedź 5 różnych lokali w jednej dzielnicy','📍','{"type":"unique_places_in_district","threshold":5}',124,true),
  ('gastro_tourist','Turysta gastronomiczny','Odwiedź lokale w 5 różnych dzielnicach Poznania','🧳','{"type":"unique_districts","threshold":5}',125,true),
  ('sushi_master','Sushi master','Oceń 10 lokali z kuchnią japońską','🍣','{"type":"reviews_cuisine_japanese","threshold":10}',130,true),
  ('pizzaiolo_fan','Pizzaiolo','Oceń 10 pizzerii','🍕','{"type":"reviews_cuisine_pizza","threshold":10}',131,true),
  ('kebab_king','Kebab king','Oceń 10 kebabowni','🥙','{"type":"reviews_cuisine_kebab","threshold":10}',132,true),
  ('ramen_runner','Ramen runner','Oceń 5 lokali z ramenem','🍜','{"type":"reviews_cuisine_ramen","threshold":5}',133,true),
  ('burger_boss','Burger boss','Oceń 10 lokali z burgerami','🍔','{"type":"reviews_cuisine_burger","threshold":10}',134,true),
  ('vege_warrior','Wege wojownik','Oceń 10 lokali wegetariańskich lub wegańskich','🥦','{"type":"reviews_cuisine_vege","threshold":10}',135,true),
  ('sweet_tooth','Słodki ząbek','Oceń 10 cukierni lub lodziarni','🍨','{"type":"reviews_cuisine_dessert","threshold":10}',136,true),
  ('coffee_connoisseur','Kawowy koneser','Oceń 10 kawiarni','☕','{"type":"reviews_cuisine_coffee","threshold":10}',137,true),
  ('world_cuisine','Kuchnia świata','Oceń lokale z 8 różnych kuchni','🌍','{"type":"distinct_cuisines","threshold":8}',138,true),
  ('fine_dining_club','Fine dining club','Oceń 5 lokali z segmentu premium','🥂','{"type":"reviews_premium","threshold":5}',139,true),
  ('half_thousand','Pół tysiąca','Zdobądź 500 punktów PoŻarcia','5️⃣','{"type":"points_total","threshold":500}',140,true),
  ('thousand_club','Klub Tysiąca','Zdobądź 1000 punktów PoŻarcia','🔟','{"type":"points_total","threshold":1000}',141,true),
  ('point_monster','Punktowy potwór','Zdobądź 5000 punktów PoŻarcia','👹','{"type":"points_total","threshold":5000}',142,true),
  ('top_ten','Top 10','Wejdź do top 10 rankingu PoŻeramy','🏆','{"type":"ranking_position","threshold":10}',143,true),
  ('number_one','Numer jeden','Zajmij 1. miejsce w rankingu PoŻeramy','🥇','{"type":"ranking_position","threshold":1}',144,true),
  ('streak_seven','Streak 7 dni','Dodawaj recenzje przez 7 dni z rzędu','📆','{"type":"review_streak_days","threshold":7}',150,true),
  ('streak_thirty','Streak 30 dni','Dodawaj recenzje przez 30 dni z rzędu','🗓️','{"type":"review_streak_days","threshold":30}',151,true),
  ('squad_goals','Paczka ziomków','Miej 10 znajomych','👥','{"type":"friends_count","threshold":10}',160,true),
  ('whole_crew','Ekipa na mieście','Miej 25 znajomych','🎉','{"type":"friends_count","threshold":25}',161,true),
  ('food_influencer','Wpływowy foodie','Twoja recenzja dostanie 50 polubień','📢','{"type":"review_likes_max","threshold":50}',170,true),
  ('trusted_voice','Zaufany głos','Twoje recenzje zbiorą łącznie 500 polubień','🙌','{"type":"review_likes_total","threshold":500}',171,true),
  ('commenter','Komentator','Skomentuj 20 recenzji innych userów','💬','{"type":"comments_count","threshold":20}',172,true),
  ('inviter','Zapraszacz','Zaproś 3 znajomych, którzy dołączą do PoŻeramy','📨','{"type":"referrals_count","threshold":3}',173,true),
  ('photo_reporter','Fotoreporter','Dodaj zdjęcia do 50 recenzji','📸','{"type":"reviews_with_photo","threshold":50}',180,true),
  ('heartfelt_review','Recenzja z sercem','Napisz recenzję dłuższą niż 300 znaków','❤️','{"type":"review_length","threshold":300}',181,true),
  ('wordy_critic','Gadatliwy krytyk','Napisz 10 recenzji dłuższych niż 300 znaków','✍️','{"type":"long_reviews_count","threshold":10}',182,true),
  ('reel_maker','Filmowiec','Dodaj 5 recenzji z filmikiem','🎬','{"type":"reviews_with_video","threshold":5}',183,true),
  ('early_bird','Ranny ptaszek','Dodaj recenzję między 6:00 a 9:00','🌅','{"type":"review_before_9am","threshold":1}',190,true),
  ('weekend_hunter','Weekendowy łowca','Dodaj recenzje w 5 różnych weekendy','🍻','{"type":"weekend_reviews","threshold":5}',191,true),
  ('lunch_ritual','Lunchowy rytuał','Dodaj 10 recenzji lokali odwiedzonych w porze lunchu (12-15)','🥪','{"type":"reviews_lunch_time","threshold":10}',192,true),
  ('valentine_foodie','Walentynkowy foodie','Dodaj recenzję 14 lutego','💘','{"type":"review_on_valentines","threshold":1}',193,true),
  ('new_years_feast','Sylwestrowa uczta','Dodaj recenzję 31 grudnia','🥂','{"type":"review_on_nye","threshold":1}',194,true),
  ('pozeramy_anniversary','Rocznica PoŻeramy','Bądź aktywny w appce w dniu jej urodzin','🎂','{"type":"active_on_app_birthday","threshold":1}',195,true),
  ('challenge_accepted','Challenge accepted','Ukończ swój pierwszy food challenge','✅','{"type":"challenges_completed","threshold":1}',200,true),
  ('challenge_maniac','Challenge maniak','Ukończ 10 food challengy','🏅','{"type":"challenges_completed","threshold":10}',201,true),
  ('code_hunter','Łowca kodów','Wykorzystaj 5 kodów rabatowych','🎟️','{"type":"discount_codes_used","threshold":5}',210,true),
  ('budget_foodie','Oszczędny smakosz','Zaoszczędź łącznie 100 zł dzięki kodom rabatowym','💰','{"type":"discount_savings_total","threshold":100}',211,true),
  ('profile_complete','Kompletny profil','Uzupełnij zdjęcie profilowe i bio','🪪','{"type":"profile_completed","threshold":true}',220,true),
  ('comeback_kid','Powracający','Wróć do appki po 30 dniach przerwy i dodaj recenzję','🔁','{"type":"returned_after_break","threshold":1}',221,true),
  ('beta_legend','Beta tester','Byłeś testerem PoŻeramy w fazie beta','🧪','{"type":"beta_tester","threshold":true}',222,true),
  ('hidden_gem_hunter','Sekretny lokal','Oceń lokal z <5 recenzjami jako jeden z pierwszych 3 recenzentów','💎','{"type":"early_reviewer_rank","threshold":3}',230,true),
  ('omnivore','Wszystkożerny','Oceń lokale z 15 różnych kuchni','🐗','{"type":"distinct_cuisines","threshold":15}',231,true),
  ('flavor_route','Marszruta smaku','Odwiedź 3 lokale w jeden dzień i dodaj recenzje','🛵','{"type":"reviews_same_day","threshold":3}',232,true)
ON CONFLICT (slug) DO NOTHING;

-- FILE: 20260723220533_d5663560-7577-4db0-8f01-17bf97642e3e.sql

-- =====================================================
-- 1) Data sources
-- =====================================================

-- Beta tester flag + "returned after break" timestamp on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_after_break_at timestamptz;

-- Video URL on reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS video_url text;

-- App birthday setting (defaults to project inception date; admin can update via site_settings)
INSERT INTO public.site_settings (key, value)
VALUES ('app_birthday', jsonb_build_object('date', '2025-01-15'))
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2) Food challenges tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.food_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.food_challenges TO authenticated, anon;
GRANT ALL ON public.food_challenges TO service_role;

ALTER TABLE public.food_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges public read" ON public.food_challenges;
CREATE POLICY "challenges public read" ON public.food_challenges
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "challenges admin write" ON public.food_challenges;
CREATE POLICY "challenges admin write" ON public.food_challenges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.food_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.food_challenges(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

GRANT SELECT, INSERT, DELETE ON public.food_challenge_completions TO authenticated;
GRANT ALL ON public.food_challenge_completions TO service_role;

ALTER TABLE public.food_challenge_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completions own read" ON public.food_challenge_completions;
CREATE POLICY "completions own read" ON public.food_challenge_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "completions admin read" ON public.food_challenge_completions;
CREATE POLICY "completions admin read" ON public.food_challenge_completions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "completions admin write" ON public.food_challenge_completions;
CREATE POLICY "completions admin write" ON public.food_challenge_completions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- =====================================================
-- 3) Triggers: returned_after_break + achievement re-check
-- =====================================================
CREATE OR REPLACE FUNCTION public.reviews_track_returned_after_break()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_prev timestamptz;
BEGIN
  SELECT max(created_at) INTO v_prev
  FROM public.reviews
  WHERE user_id = NEW.user_id AND id <> NEW.id AND created_at < NEW.created_at;

  IF v_prev IS NOT NULL AND (NEW.created_at - v_prev) > INTERVAL '30 days' THEN
    UPDATE public.profiles
    SET returned_after_break_at = NEW.created_at
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reviews_returned_after_break ON public.reviews;
CREATE TRIGGER trg_reviews_returned_after_break
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_track_returned_after_break();

CREATE OR REPLACE FUNCTION public.food_challenge_completion_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_challenge_completion_award ON public.food_challenge_completions;
CREATE TRIGGER trg_challenge_completion_award
  AFTER INSERT ON public.food_challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.food_challenge_completion_award();

-- =====================================================
-- 4) Extend check_achievements with real data sources
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ach record;
  v_count int;
  v_meets boolean;
  v_type text;
  v_threshold int;
  v_total_other int;
  v_user_other int;
  v_cuisine_pattern text;
  v_has_bool boolean;
  v_app_birthday date;
BEGIN
  FOR ach IN SELECT id, slug, criteria FROM public.achievements WHERE enabled = true LOOP
    v_type := ach.criteria->>'type';
    v_threshold := COALESCE(NULLIF(NULLIF(ach.criteria->>'threshold','true'),'false'), '1')::int;
    v_meets := false;

    IF v_type = 'reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'points_total' THEN
      SELECT COALESCE(points_total,0) INTO v_count FROM public.profiles WHERE id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'friends_count' THEN
      v_count := public.get_friends_count(_user_id);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_at_night' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND (EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) >= 23
          OR EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) < 3);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_with_photo' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND photo_url IS NOT NULL AND photo_url <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_streak_days' THEN
      WITH days AS (
        SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM public.reviews WHERE user_id = _user_id
      ),
      grp AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int * INTERVAL '1 day' AS g FROM days),
      streaks AS (SELECT count(*)::int AS len FROM grp GROUP BY g)
      SELECT COALESCE(max(len), 0) INTO v_count FROM streaks;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'one_star_reviews' THEN
      SELECT count(DISTINCT place_id) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND rating = 1;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'distinct_cuisines' THEN
      SELECT count(DISTINCT pl.cuisine) INTO v_count
      FROM public.reviews rv JOIN public.places pl ON pl.id = rv.place_id
      WHERE rv.user_id = _user_id AND pl.cuisine IS NOT NULL AND pl.cuisine <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'all_achievements' THEN
      SELECT count(*) INTO v_total_other FROM public.achievements
        WHERE enabled = true AND slug <> 'pozaramy_legend';
      SELECT count(*) INTO v_user_other FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug <> 'pozaramy_legend';
      v_meets := v_total_other > 0 AND v_user_other >= v_total_other;
    ELSIF v_type = 'reviews_this_month' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw')
          = date_trunc('month', (now() AT TIME ZONE 'Europe/Warsaw'));
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'first_review_new_place' THEN
      SELECT count(*) INTO v_count FROM public.reviews r WHERE r.user_id = _user_id
        AND NOT EXISTS (SELECT 1 FROM public.reviews r2 WHERE r2.place_id = r.place_id AND r2.created_at < r.created_at);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_places_in_district' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(DISTINCT r.place_id) AS cnt
        FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> ''
        GROUP BY pl.district) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'unique_districts' THEN
      SELECT count(DISTINCT pl.district) INTO v_count
      FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.district IS NOT NULL AND pl.district <> '';
      v_meets := v_count >= v_threshold;
    ELSIF v_type LIKE 'reviews_cuisine_%' THEN
      v_cuisine_pattern := CASE substring(v_type FROM 'reviews_cuisine_(.*)')
        WHEN 'japanese' THEN '(japo|sushi)'
        WHEN 'pizza'    THEN 'pizz'
        WHEN 'kebab'    THEN 'kebab'
        WHEN 'ramen'    THEN 'ramen'
        WHEN 'burger'   THEN 'burger'
        WHEN 'vege'     THEN '(wege|wegań|wegan|vege|vegan)'
        WHEN 'dessert'  THEN '(cukier|lody|lodz|deser|dessert)'
        WHEN 'coffee'   THEN '(kawa|kawiar|coffee|café|cafe)'
        ELSE NULL END;
      IF v_cuisine_pattern IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
        WHERE r.user_id = _user_id AND pl.cuisine ~* v_cuisine_pattern;
        v_meets := v_count >= v_threshold;
      END IF;
    ELSIF v_type = 'reviews_premium' THEN
      SELECT count(*) INTO v_count FROM public.reviews r JOIN public.places pl ON pl.id = r.place_id
      WHERE r.user_id = _user_id AND pl.price_range ~ '\$\$\$\$';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'ranking_position' THEN
      SELECT rnk INTO v_count FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0
      ) s WHERE id = _user_id;
      IF v_count IS NOT NULL THEN v_meets := v_count <= v_threshold; END IF;
    ELSIF v_type = 'review_likes_max' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.review_reactions rr
        JOIN public.reviews r ON r.id = rr.review_id
        WHERE r.user_id = _user_id GROUP BY rr.review_id) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_likes_total' THEN
      SELECT count(*) INTO v_count FROM public.review_reactions rr
      JOIN public.reviews r ON r.id = rr.review_id WHERE r.user_id = _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'comments_count' THEN
      SELECT count(*) INTO v_count FROM public.review_comments rc
      JOIN public.reviews r ON r.id = rc.review_id
      WHERE rc.user_id = _user_id AND r.user_id <> _user_id;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'referrals_count' THEN
      SELECT count(*) INTO v_count FROM public.friend_invites
      WHERE inviter_id = _user_id AND status = 'accepted';
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_length' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= v_threshold;
      v_meets := v_count >= 1;
    ELSIF v_type = 'long_reviews_count' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND length(coalesce(body,'')) >= 300;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_before_9am' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 6 AND 8;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'weekend_reviews' THEN
      SELECT count(DISTINCT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw')) INTO v_count
      FROM public.reviews WHERE user_id = _user_id
        AND EXTRACT(ISODOW FROM (created_at AT TIME ZONE 'Europe/Warsaw')) IN (6,7);
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_lunch_time' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Warsaw')) BETWEEN 12 AND 14;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_on_valentines' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 2
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 14;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'review_on_nye' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id
        AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 12
        AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = 31;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'reviews_same_day' THEN
      SELECT COALESCE(max(cnt), 0) INTO v_count FROM (
        SELECT count(*) AS cnt FROM public.reviews WHERE user_id = _user_id
        GROUP BY (created_at AT TIME ZONE 'Europe/Warsaw')::date) s;
      v_meets := v_count >= v_threshold;
    ELSIF v_type = 'early_reviewer_rank' THEN
      SELECT count(*) INTO v_count FROM (
        SELECT r.place_id,
          row_number() OVER (PARTITION BY r.place_id ORDER BY r.created_at ASC) AS rnk,
          count(*) OVER (PARTITION BY r.place_id) AS total,
          r.user_id
        FROM public.reviews r
      ) s
      WHERE s.total < 5 AND s.rnk <= v_threshold AND s.user_id = _user_id;
      v_meets := v_count >= 1;
    ELSIF v_type = 'profile_completed' THEN
      SELECT (avatar_url IS NOT NULL AND avatar_url <> '' AND bio IS NOT NULL AND length(trim(bio)) > 0)
        INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    -- ===== NEW: real data sources =====
    ELSIF v_type = 'beta_tester' THEN
      SELECT is_beta_tester INTO v_has_bool FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    ELSIF v_type = 'returned_after_break' THEN
      SELECT (returned_after_break_at IS NOT NULL) INTO v_has_bool
      FROM public.profiles WHERE id = _user_id;
      v_meets := COALESCE(v_has_bool, false);

    ELSIF v_type = 'active_on_app_birthday' THEN
      SELECT (value->>'date')::date INTO v_app_birthday
      FROM public.site_settings WHERE key = 'app_birthday';
      IF v_app_birthday IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.reviews
        WHERE user_id = _user_id
          AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(MONTH FROM v_app_birthday)
          AND EXTRACT(DAY FROM (created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(DAY FROM v_app_birthday);
        v_meets := v_count >= 1;
      END IF;

    ELSIF v_type = 'challenges_completed' THEN
      SELECT count(*) INTO v_count FROM public.food_challenge_completions WHERE user_id = _user_id;
      v_meets := v_count >= v_threshold;

    ELSIF v_type = 'reviews_with_video' THEN
      SELECT count(*) INTO v_count FROM public.reviews
      WHERE user_id = _user_id AND video_url IS NOT NULL AND video_url <> '';
      v_meets := v_count >= v_threshold;

    -- discount codes / savings not implemented yet
    ELSIF v_type IN ('discount_codes_used','discount_savings_total') THEN
      v_meets := false;
    END IF;

    IF v_meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (_user_id, ach.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- =====================================================
-- 5) Diagnostic function (admin-only) for verification
-- =====================================================
CREATE OR REPLACE FUNCTION public.debug_achievement_metrics(_user_id uuid)
RETURNS TABLE(slug text, type text, threshold text, meets boolean, current_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ach record;
  v_type text;
  v_threshold_txt text;
  v_val text;
  v_meets boolean;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR ach IN SELECT a.slug, a.criteria FROM public.achievements a WHERE a.enabled = true ORDER BY a.sort_order LOOP
    v_type := ach.criteria->>'type';
    v_threshold_txt := ach.criteria->>'threshold';
    v_val := NULL; v_meets := false;

    IF v_type = 'beta_tester' THEN
      SELECT is_beta_tester::text INTO v_val FROM public.profiles WHERE id = _user_id;
      v_meets := (v_val = 'true');
    ELSIF v_type = 'returned_after_break' THEN
      SELECT (returned_after_break_at IS NOT NULL)::text INTO v_val FROM public.profiles WHERE id = _user_id;
      v_meets := (v_val = 'true');
    ELSIF v_type = 'challenges_completed' THEN
      SELECT count(*)::text INTO v_val FROM public.food_challenge_completions WHERE user_id = _user_id;
      v_meets := v_val::int >= v_threshold_txt::int;
    ELSIF v_type = 'reviews_with_video' THEN
      SELECT count(*)::text INTO v_val FROM public.reviews WHERE user_id = _user_id AND video_url IS NOT NULL AND video_url <> '';
      v_meets := v_val::int >= v_threshold_txt::int;
    ELSIF v_type = 'ranking_position' THEN
      SELECT rnk::text INTO v_val FROM (
        SELECT id, row_number() OVER (ORDER BY points_total DESC, created_at ASC) AS rnk
        FROM public.profiles WHERE COALESCE(points_total,0) > 0) s WHERE id = _user_id;
      v_meets := v_val IS NOT NULL AND v_val::int <= v_threshold_txt::int;
    ELSIF v_type = 'active_on_app_birthday' THEN
      SELECT count(*)::text INTO v_val FROM public.reviews r,
        (SELECT (value->>'date')::date d FROM public.site_settings WHERE key='app_birthday') s
        WHERE r.user_id = _user_id
          AND EXTRACT(MONTH FROM (r.created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(MONTH FROM s.d)
          AND EXTRACT(DAY FROM (r.created_at AT TIME ZONE 'Europe/Warsaw')) = EXTRACT(DAY FROM s.d);
      v_meets := COALESCE(v_val::int, 0) >= 1;
    ELSE
      v_val := '(computed in check_achievements)';
      v_meets := EXISTS (SELECT 1 FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = _user_id AND a.slug = ach.slug);
    END IF;

    RETURN QUERY SELECT ach.slug, v_type, v_threshold_txt, v_meets, v_val;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.debug_achievement_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_achievement_metrics(uuid) TO authenticated;

-- =====================================================
-- 6) Re-check every existing user so backfill triggers
-- =====================================================
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    PERFORM public.check_achievements(u);
  END LOOP;
END $$;

-- FILE: 20260723221835_538dd82f-5a1d-4345-b6b8-8eae5da8dd80.sql

CREATE OR REPLACE FUNCTION public.run_achievement_tests()
RETURNS TABLE(test_name text, status text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_user3 uuid := gen_random_uuid();
  v_place uuid;
  v_challenge uuid;
  v_extra_challenges uuid[] := ARRAY[]::uuid[];
  v_ach_reel uuid;
  v_ach_ca uuid;
  v_ach_cm uuid;
  v_has boolean;
  i int;
  v_cid uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  SELECT id INTO v_ach_reel FROM public.achievements WHERE slug = 'reel_maker';
  SELECT id INTO v_ach_ca   FROM public.achievements WHERE slug = 'challenge_accepted';
  SELECT id INTO v_ach_cm   FROM public.achievements WHERE slug = 'challenge_maniac';

  -- Create auth users + profiles
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  VALUES
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-reel-'||v_user1||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-ca-'||v_user2||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false),
    (v_user3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-cm-'||v_user3||'@test.local', '', now(), now(), now(), '{"provider":"test"}'::jsonb, '{}'::jsonb, false);

  INSERT INTO public.profiles (id, display_name) VALUES
    (v_user1, 'test-reel'), (v_user2, 'test-ca'), (v_user3, 'test-cm')
  ON CONFLICT (id) DO NOTHING;

  -- Test place
  INSERT INTO public.places (name, cuisine, address, lat, lng, slug, is_published)
  VALUES ('__test_place__', 'test', 'test', 52.4, 16.9, '__test_place_'||gen_random_uuid()::text, false)
  RETURNING id INTO v_place;

  -- Ensure at least 10 challenges exist for challenge_maniac
  SELECT id INTO v_challenge FROM public.food_challenges LIMIT 1;
  IF v_challenge IS NULL THEN
    FOR i IN 1..10 LOOP
      INSERT INTO public.food_challenges (title, description, enabled, sort_order)
      VALUES ('__test_ch_'||i, 'test', true, 9000+i)
      RETURNING id INTO v_cid;
      v_extra_challenges := v_extra_challenges || v_cid;
    END LOOP;
  ELSE
    -- Ensure we have 10 total; create the rest
    FOR i IN 1..10 - (SELECT count(*)::int FROM public.food_challenges) LOOP
      INSERT INTO public.food_challenges (title, description, enabled, sort_order)
      VALUES ('__test_ch_'||i, 'test', true, 9000+i)
      RETURNING id INTO v_cid;
      v_extra_challenges := v_extra_challenges || v_cid;
    END LOOP;
  END IF;

  -- ============================================================
  -- TEST 1: reel_maker requires video_url; photo-only does not count
  -- ============================================================
  -- Insert 5 reviews with photo but NO video
  FOR i IN 1..5 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, photo_url, video_url)
    VALUES (v_place, v_user1, 5, 'r'||i, 'https://example.com/p.jpg', NULL);
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_photo_only_should_not_unlock'::text, 'FAIL'::text, 'unlocked despite no video_url'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_photo_only_should_not_unlock'::text, 'PASS'::text, '5 photo reviews did not unlock reel_maker'::text;
  END IF;

  -- Add 4 video reviews (total 4 < 5) — still should not unlock
  FOR i IN 1..4 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
    VALUES (v_place, v_user1, 5, 'v'||i, 'https://example.com/v'||i||'.mp4');
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_below_threshold_should_not_unlock'::text, 'FAIL'::text, '4 video reviews unlocked reel_maker'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_below_threshold_should_not_unlock'::text, 'PASS'::text, '4 video reviews did not unlock'::text;
  END IF;

  -- Add 5th video review → threshold met
  INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
  VALUES (v_place, v_user1, 5, 'v5', 'https://example.com/v5.mp4');

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user1 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_at_threshold_should_unlock'::text, 'PASS'::text, '5 video reviews unlocked reel_maker'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_at_threshold_should_unlock'::text, 'FAIL'::text, '5 video reviews did NOT unlock'::text;
  END IF;

  -- Additional guard: empty-string video_url must not count
  DELETE FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_reel;
  FOR i IN 1..5 LOOP
    INSERT INTO public.reviews (place_id, user_id, rating, body, video_url)
    VALUES (v_place, v_user2, 5, 'e'||i, '');
  END LOOP;
  PERFORM public.check_achievements(v_user2);
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_reel) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'reel_maker_empty_string_video_should_not_unlock'::text, 'FAIL'::text, 'empty video_url counted'::text;
  ELSE
    RETURN QUERY SELECT 'reel_maker_empty_string_video_should_not_unlock'::text, 'PASS'::text, 'empty string ignored'::text;
  END IF;

  -- ============================================================
  -- TEST 2: challenge_accepted (>=1) and challenge_maniac (>=10)
  -- ============================================================
  SELECT id INTO v_challenge FROM public.food_challenges ORDER BY sort_order, id LIMIT 1;

  -- Before any completions
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_ca) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_accepted_zero_should_not_unlock'::text, 'FAIL'::text, 'unlocked with 0 completions'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_accepted_zero_should_not_unlock'::text, 'PASS'::text, 'no completions, locked'::text;
  END IF;

  -- 1 completion → challenge_accepted unlocks (trigger runs check_achievements)
  INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user2, v_challenge);

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_ca) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_accepted_one_should_unlock'::text, 'PASS'::text, '1 completion unlocked'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_accepted_one_should_unlock'::text, 'FAIL'::text, '1 completion did NOT unlock'::text;
  END IF;

  -- challenge_maniac should NOT be unlocked yet
  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user2 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_below_should_not_unlock'::text, 'FAIL'::text, 'unlocked at 1'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_below_should_not_unlock'::text, 'PASS'::text, '1 completion locked'::text;
  END IF;

  -- Complete 9 distinct challenges for user3 (below threshold)
  FOR v_cid IN SELECT id FROM public.food_challenges ORDER BY sort_order, id LIMIT 9 LOOP
    INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user3, v_cid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user3 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_nine_should_not_unlock'::text, 'FAIL'::text, '9 unlocked cm'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_nine_should_not_unlock'::text, 'PASS'::text, '9 completions locked cm'::text;
  END IF;

  -- 10th completion → challenge_maniac unlocks
  FOR v_cid IN SELECT id FROM public.food_challenges ORDER BY sort_order, id OFFSET 9 LIMIT 1 LOOP
    INSERT INTO public.food_challenge_completions (user_id, challenge_id) VALUES (v_user3, v_cid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = v_user3 AND achievement_id = v_ach_cm) INTO v_has;
  IF v_has THEN
    RETURN QUERY SELECT 'challenge_maniac_ten_should_unlock'::text, 'PASS'::text, '10 completions unlocked cm'::text;
  ELSE
    RETURN QUERY SELECT 'challenge_maniac_ten_should_unlock'::text, 'FAIL'::text, '10 completions did NOT unlock cm'::text;
  END IF;

  -- ============================================================
  -- CLEANUP
  -- ============================================================
  DELETE FROM public.food_challenge_completions WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.reviews WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.user_achievements WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.points_transactions WHERE user_id IN (v_user1, v_user2, v_user3);
  DELETE FROM public.places WHERE id = v_place;
  IF array_length(v_extra_challenges, 1) > 0 THEN
    DELETE FROM public.food_challenges WHERE id = ANY(v_extra_challenges);
  END IF;
  DELETE FROM public.profiles WHERE id IN (v_user1, v_user2, v_user3);
  DELETE FROM auth.users WHERE id IN (v_user1, v_user2, v_user3);
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_achievement_tests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_achievement_tests() TO service_role;

-- FILE: 20260723222208_50c74310-5020-4c70-bbab-c116a15ff619.sql

CREATE OR REPLACE FUNCTION public.admin_set_beta_tester(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles SET is_beta_tester = COALESCE(_value, false) WHERE id = _user_id;
  PERFORM public.check_achievements(_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_beta_tester(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_beta_tester(uuid, boolean) TO authenticated;

