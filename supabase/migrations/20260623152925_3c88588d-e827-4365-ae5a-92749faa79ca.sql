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

