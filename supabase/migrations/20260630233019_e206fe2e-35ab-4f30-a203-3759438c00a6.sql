CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'efi-cycle-hourly') THEN
    PERFORM cron.unschedule('efi-cycle-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'efi-cycle-hourly',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dashboard.usenexoapp.com/api/public/hooks/efi-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
  $$
);