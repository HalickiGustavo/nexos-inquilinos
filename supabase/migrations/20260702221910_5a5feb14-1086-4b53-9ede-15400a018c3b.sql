
-- Re-agenda os 4 jobs financeiros com Authorization: Bearer <CRON_SECRET>
-- lido da vault. Se o segredo não estiver na vault, as rotas responderão 401
-- (fail-closed).

SELECT cron.unschedule('stark-process-payouts');
SELECT cron.unschedule('stark-reconcile-charges');
SELECT cron.unschedule('generate-upcoming-boletos-daily');
SELECT cron.unschedule('reconcile-stark-charges-hourly');

SELECT cron.schedule(
  'stark-process-payouts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nexos-inquilinos.lovable.app/api/public/hooks/process-payout-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'stark-reconcile-charges',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nexos-inquilinos.lovable.app/api/public/hooks/reconcile-stark-charges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'generate-upcoming-boletos-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/generate-upcoming-boletos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'reconcile-stark-charges-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/reconcile-stark-charges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
