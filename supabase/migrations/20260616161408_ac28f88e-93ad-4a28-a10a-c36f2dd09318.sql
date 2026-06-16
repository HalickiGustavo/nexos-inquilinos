
CREATE OR REPLACE FUNCTION public.sync_cron_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  existing_id uuid;
BEGIN
  -- Apenas o service_role (backend confiável) pode executar esta função.
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'CRON_SECRET', 'Cron job shared secret');
  ELSE
    PERFORM vault.update_secret(existing_id, _secret, 'CRON_SECRET', 'Cron job shared secret');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cron_secret(text) TO service_role;
