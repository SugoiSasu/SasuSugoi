-- Cookie-consent choices were only ever stored in the visitor's own
-- localStorage — provable to the visitor, but not to us (no queryable
-- record if we ever needed to demonstrate what a given session consented
-- to and when). Mirrors the collab_submissions consent-logging pattern,
-- but write-only and keyed by a random per-browser id, never a real
-- identity — this is operational proof-of-consent, not tracking.

CREATE TABLE public.cookie_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id text NOT NULL,
  analytics_storage boolean NOT NULL,
  ad_storage boolean NOT NULL,
  ad_user_data boolean NOT NULL,
  ad_personalization boolean NOT NULL,
  consent_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cookie_consent_log_anon_id_idx ON public.cookie_consent_log(anon_id);

GRANT INSERT ON public.cookie_consent_log TO anon, authenticated;
GRANT ALL ON public.cookie_consent_log TO service_role;

ALTER TABLE public.cookie_consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cookie_consent_log anyone inserts" ON public.cookie_consent_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "cookie_consent_log admin reads" ON public.cookie_consent_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role,'super_admin'::app_role)));
