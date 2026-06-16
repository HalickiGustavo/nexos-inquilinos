
-- Audit logs for sensitive operations (Asaas charges, maintenances, etc.)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity, entity_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only managers/owners can read audit logs; users cannot write directly (only via triggers or service_role)
CREATE POLICY "managers and owners read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

-- No client INSERT policy: writes happen via SECURITY DEFINER trigger or service_role from server functions.

-- ===== Trigger for maintenances changes =====
CREATE OR REPLACE FUNCTION public.log_maintenance_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_id text;
  v_ip text;
  v_ua text;
  v_email text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'maintenance.create';
    v_id := NEW.id::text;
    v_meta := jsonb_build_object('title', NEW.title, 'status', NEW.status, 'property_id', NEW.property_id);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'maintenance.update';
    v_id := NEW.id::text;
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
    v_action := 'maintenance.delete';
    v_id := OLD.id::text;
    v_meta := jsonb_build_object('title', OLD.title, 'status', OLD.status);
  END IF;

  -- Extract IP / UA from PostgREST request headers (set by Supabase Data API)
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
  VALUES (auth.uid(), v_email, v_action, 'maintenances', v_id, v_ip, v_ua, COALESCE(v_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER maintenances_audit_log
AFTER INSERT OR UPDATE OR DELETE ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.log_maintenance_changes();
