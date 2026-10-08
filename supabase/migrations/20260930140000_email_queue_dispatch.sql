-- Wysylka maili z kolejki: co minute pg_cron wola endpoint aplikacji
-- /lovable/email/queue/process (pg_net), ktory czyta kolejki pgmq i wysyla przez
-- Resend. Po migracji z Lovable to zadanie nigdy nie zostalo odtworzone, wiec
-- maile z kolejki (potwierdzenie rejestracji, reset hasla, potwierdzenia
-- formularzy) nie byly wysylane od czerwca.
--
-- Endpoint wymaga naglowka Authorization: Bearer <service role key>. Klucz NIE
-- jest w migracji: czytamy go z Vault (sekret "email_queue_service_role_key"),
-- ktory trzeba zalozyc osobno. Bez sekretu zadanie kreci sie bez skutku (401).
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  -- Nie budzimy aplikacji, gdy obie kolejki sa puste.
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE WARNING 'email_queue_dispatch: brak sekretu email_queue_service_role_key w Vault';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://pozeramy.live/lovable/email/queue/process',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END $$;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('process-email-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue');
  PERFORM cron.schedule('process-email-queue', '* * * * *', 'SELECT public.email_queue_dispatch()');
END $$;
