
-- =========================================================================
-- 1) Atomic claim para payment_transfers (BUG-C3)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_pending_transfers(_limit int DEFAULT 20)
RETURNS SETOF public.payment_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.payment_transfers
    WHERE status = 'PENDING'
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at NULLS FIRST
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.payment_transfers t
     SET status = 'PROCESSING'
    FROM picked
   WHERE t.id = picked.id
  RETURNING t.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_transfers(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_transfers(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_transfers(int) TO service_role;

-- =========================================================================
-- 2) Índices de performance (BUG-M8)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_payment_transfers_status_next_retry
  ON public.payment_transfers (status, next_retry_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_payment_transfers_installment
  ON public.payment_transfers (installment_id);

CREATE INDEX IF NOT EXISTS idx_installments_contract_due
  ON public.installments (contract_id, due_date);

CREATE INDEX IF NOT EXISTS idx_installments_user_status_due
  ON public.installments (user_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_contracts_property_active
  ON public.contracts (property_id, active);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_active
  ON public.contracts (tenant_id, active);

CREATE INDEX IF NOT EXISTS idx_properties_user
  ON public.properties (user_id);

CREATE INDEX IF NOT EXISTS idx_properties_landlord
  ON public.properties (landlord_id);

CREATE INDEX IF NOT EXISTS idx_tenants_user_link
  ON public.tenants (user_id_link);

CREATE INDEX IF NOT EXISTS idx_maintenances_property
  ON public.maintenances (property_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_contract
  ON public.maintenances (contract_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_manager_members_member_status
  ON public.manager_members (member_user_id, status);

CREATE INDEX IF NOT EXISTS idx_manager_members_manager_status
  ON public.manager_members (manager_user_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_leads_manager_created
  ON public.crm_leads (manager_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity, entity_id, created_at DESC);

-- =========================================================================
-- 3) Verificação diária de invariantes de segurança
-- =========================================================================
CREATE OR REPLACE FUNCTION public.run_security_invariants_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_meta jsonb := '[]'::jsonb;
BEGIN
  FOR v_row IN SELECT * FROM public.verify_security_invariants() LOOP
    v_meta := v_meta || jsonb_build_object(
      'check', v_row.check_name,
      'status', v_row.status,
      'details', v_row.details
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, metadata)
  VALUES (NULL, 'system@cron', 'security.invariants_check', 'system', NULL,
          jsonb_build_object('checks', v_meta, 'run_at', now()));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, metadata)
  VALUES (NULL, 'system@cron', 'security.invariants_check_failed', 'system', NULL,
          jsonb_build_object('error', SQLERRM, 'run_at', now()));
END;
$$;

REVOKE ALL ON FUNCTION public.run_security_invariants_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_invariants_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_invariants_check() TO service_role;

-- Agendar diariamente 03:15 (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('security-invariants-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-invariants-daily');

    PERFORM cron.schedule(
      'security-invariants-daily',
      '15 3 * * *',
      $CRON$ SELECT public.run_security_invariants_check(); $CRON$
    );
  END IF;
END $$;
