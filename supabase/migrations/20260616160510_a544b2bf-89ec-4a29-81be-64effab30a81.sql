
CREATE SCHEMA IF NOT EXISTS extensions;

-- pg_net não suporta SET SCHEMA; remover e recriar no schema correto.
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-invoices-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Reagenda o cron usando a service role key (server-only).
SELECT cron.schedule(
  'process-scheduled-invoices-daily',
  '0 8 * * *',
  $cmd$
  SELECT extensions.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/process-scheduled-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
