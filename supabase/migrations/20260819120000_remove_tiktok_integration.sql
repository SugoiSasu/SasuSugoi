-- TikTok Login Kit OAuth setup was abandoned (dashboard config never finished,
-- no token was ever issued) — drop the now-unused tables and any leftover
-- 'tiktok' row in social_accounts. The 'tiktok' value stays in the
-- social_platform enum (Postgres can't cheaply drop enum values), it's just
-- no longer offered in the admin UI or synced.

DROP TABLE IF EXISTS public.tiktok_oauth_tokens;
DROP TABLE IF EXISTS public.tiktok_oauth_flow;

DELETE FROM public.social_accounts WHERE platform = 'tiktok';
