-- Real TikTok Login Kit OAuth (replaces the old Lovable connector-gateway proxy).
-- Both tables hold sensitive credentials (PKCE verifiers, access/refresh tokens) and
-- must NEVER be exposed to anon/authenticated — only service_role (bypasses RLS) touches them.

CREATE TABLE public.tiktok_oauth_flow (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_oauth_flow ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tiktok_oauth_flow TO service_role;
-- No policies, no anon/authenticated grants: table is invisible outside service_role.

CREATE TABLE public.tiktok_oauth_tokens (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton: one connected account
  open_id TEXT,
  scope TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_oauth_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tiktok_oauth_tokens TO service_role;
-- No policies, no anon/authenticated grants: token values must never leak via PostgREST.

CREATE TRIGGER tiktok_oauth_tokens_updated_at
  BEFORE UPDATE ON public.tiktok_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
