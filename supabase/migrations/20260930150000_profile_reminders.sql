-- Przypomnienie o uzupelnieniu profilu (mail po dobie od rejestracji).
-- Tabela pilnuje, ze kazdy dostaje je tylko raz.
CREATE TABLE IF NOT EXISTS public.profile_reminders (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_reminders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profile_reminders TO service_role;

-- Wiadomosci transakcyjne zyja do 12 h (bylo 60 min): jesli wysylka akurat nie
-- dziala, przypomnienie ma szanse dojsc, zamiast trafic do kosza (DLQ).
UPDATE public.email_send_state SET transactional_email_ttl_minutes = 720 WHERE transactional_email_ttl_minutes < 720;

CREATE OR REPLACE FUNCTION public.profile_reminders_dispatch()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE WARNING 'profile_reminders_dispatch: brak sekretu email_queue_service_role_key w Vault';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://pozeramy.live/lovable/email/profile-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END $$;
REVOKE ALL ON FUNCTION public.profile_reminders_dispatch() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('profile-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'profile-reminders');
  -- 09:00 UTC = 10:00/11:00 w Polsce.
  PERFORM cron.schedule('profile-reminders', '0 9 * * *', 'SELECT public.profile_reminders_dispatch()');
END $$;
