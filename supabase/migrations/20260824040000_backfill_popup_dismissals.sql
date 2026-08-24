-- 20260824030000 added onboarding_seen_at/ig_popup_dismissed_at with no
-- backfill, so every pre-existing account (which almost certainly already
-- saw and dismissed both, ages ago, via the old localStorage-only gate) got
-- shown the onboarding tour and IG popup again on any device/browser where
-- that localStorage flag wasn't already set. Backfill everyone who existed
-- before this fix so only genuinely new signups see them.

UPDATE public.profiles
SET
  onboarding_seen_at = COALESCE(onboarding_seen_at, created_at),
  ig_popup_dismissed_at = COALESCE(ig_popup_dismissed_at, created_at)
WHERE onboarding_seen_at IS NULL OR ig_popup_dismissed_at IS NULL;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Naprawiono ponowne pokazywanie się tutoriala i popupu Instagrama istniejącym kontom - zbackfillowano stan "widziane" dla wszystkich kont sprzed tej zmiany.');
