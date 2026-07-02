
-- Remove entrada com secret NULL criada por engano
DELETE FROM vault.secrets WHERE name = 'CRON_SECRET' AND secret IS NULL;

-- Corrige a checagem para funcionar com chaves sb_secret_* atuais:
-- aceitamos quando auth.role()='service_role' (PostgREST) OU sessão postgres.
CREATE OR REPLACE FUNCTION public.sync_cron_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  existing_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _secret IS NULL OR length(_secret) = 0 THEN
    RAISE EXCEPTION 'empty secret';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'CRON_SECRET', 'Cron job shared secret');
  ELSE
    PERFORM vault.update_secret(existing_id, _secret, 'CRON_SECRET', 'Cron job shared secret');
  END IF;
END;
$function$;

-- Restringe execute para apenas service_role (chamado a partir do server)
REVOKE ALL ON FUNCTION public.sync_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cron_secret(text) TO service_role;
