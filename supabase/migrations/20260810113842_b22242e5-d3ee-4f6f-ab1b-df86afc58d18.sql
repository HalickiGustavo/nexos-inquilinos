-- 1. Create a function to validate migrations and prevent mass deletes
CREATE OR REPLACE FUNCTION public.prevent_mass_delete_logic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_query text;
BEGIN
    -- Only check if running as service_role (which is what migrations use)
    IF current_user <> 'service_role' THEN
        RETURN NULL;
    END IF;

    -- Check if we have an override variable set
    -- To allow controlled mass deletes, one must run: SET local app.allow_mass_delete = 'true';
    IF current_setting('app.allow_mass_delete', true) = 'true' THEN
        RETURN NULL;
    END IF;

    -- Get the current query
    v_query := current_query();
    
    RAISE EXCEPTION 'Mass DELETE protection: service_role is not allowed to execute DELETE without setting app.allow_mass_delete = ''true''. Query: %', v_query;
END;
$$;

-- Apply to critical tables
DROP TRIGGER IF EXISTS trg_prevent_mass_delete_contracts ON public.contracts;
CREATE TRIGGER trg_prevent_mass_delete_contracts
BEFORE DELETE ON public.contracts
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_mass_delete_logic();

DROP TRIGGER IF EXISTS trg_prevent_mass_delete_installments ON public.installments;
CREATE TRIGGER trg_prevent_mass_delete_installments
BEFORE DELETE ON public.installments
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_mass_delete_logic();

DROP TRIGGER IF EXISTS trg_prevent_mass_delete_properties ON public.properties;
CREATE TRIGGER trg_prevent_mass_delete_properties
BEFORE DELETE ON public.properties
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_mass_delete_logic();

-- 2. Enhanced log_generic_changes to include user context more reliably
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
  v_user_id uuid;
  v_jwt_claims jsonb;
BEGIN
  -- Capture JWT claims safely
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    v_email := v_jwt_claims->>'email';
    v_user_id := (v_jwt_claims->>'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
    v_email := NULL;
    v_user_id := NULL;
  END;

  -- Fallback for user_id if not in JWT (e.g. direct SQL via service_role)
  IF v_user_id IS NULL AND current_user = 'service_role' THEN
     v_email := 'service_role@system';
  ELSIF v_user_id IS NULL THEN
     v_user_id := auth.uid();
  END IF;

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

  -- Capture HTTP context
  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL;
  END;

  INSERT INTO public.audit_logs (
    user_id, 
    user_email, 
    action, 
    entity, 
    entity_id, 
    ip_address, 
    user_agent, 
    metadata
  )
  VALUES (
    v_user_id, 
    COALESCE(v_email, 'unknown'), 
    v_action, 
    v_entity, 
    v_id, 
    v_ip, 
    v_ua, 
    jsonb_build_object(
      'data', COALESCE(v_meta, '{}'::jsonb),
      'context', jsonb_build_object(
        'current_user', current_user,
        'session_user', session_user,
        'transaction_id', txid_current()
      )
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
