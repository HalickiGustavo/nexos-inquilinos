
-- Reagenda o cron usando o CRON_SECRET armazenado no Vault.
-- O valor real será inserido no vault por uma função server-side admin
-- (installCronSecret) que lê process.env.CRON_SECRET.
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-invoices-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-scheduled-invoices-daily',
  '0 8 * * *',
  $cmd$
  SELECT extensions.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/process-scheduled-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
