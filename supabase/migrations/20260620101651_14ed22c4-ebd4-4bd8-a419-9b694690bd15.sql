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

