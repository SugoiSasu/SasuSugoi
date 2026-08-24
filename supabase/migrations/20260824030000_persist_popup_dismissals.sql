-- The Instagram-follow popup and onboarding tour were only gated by
-- localStorage, so any cache clear, incognito window, or new device made
-- the same account see them again. Move the "seen" flag onto the account
-- itself; localStorage stays as a fast first-paint check on top of this.

ALTER TABLE public.profiles
  ADD COLUMN onboarding_seen_at timestamptz,
  ADD COLUMN ig_popup_dismissed_at timestamptz;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Popup "obserwuj na Instagramie" i tour onboardingowy zapamiętują teraz odrzucenie na koncie, nie tylko w localStorage przeglądarki.');
