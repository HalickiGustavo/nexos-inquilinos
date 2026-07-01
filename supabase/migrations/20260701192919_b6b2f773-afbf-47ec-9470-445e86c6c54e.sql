DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE command ILIKE '%efi%' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;