
-- Generic audit trigger factory reused for properties, contracts, installments, debt_agreements.
CREATE OR REPLACE FUNCTION public.log_generic_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_entity text := TG_TABLE_NAME;
  v_id text;
  v_ip text;
  v_ua text;
  v_email text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := v_entity || '.create';
    v_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := v_entity || '.update';
    v_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
        AND key NOT IN ('updated_at')
      )
    );
  ELSE
    v_action := v_entity || '.delete';
    v_id := (to_jsonb(OLD)->>'id');
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
    v_email := current_setting('request.jwt.claims', true)::json->>'email';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL; v_email := NULL;
  END;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, ip_address, user_agent, metadata)
  VALUES (auth.uid(), v_email, v_action, v_entity, v_id, v_ip, v_ua, COALESCE(v_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure properties table is audited
DROP TRIGGER IF EXISTS trg_audit_properties ON public.properties;
CREATE TRIGGER trg_audit_properties
AFTER INSERT OR UPDATE OR DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();
