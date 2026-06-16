
-- Tighten audit_logs privileges (default PUBLIC grants existed)
REVOKE ALL ON public.audit_logs FROM PUBLIC;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.verify_security_invariants()
RETURNS TABLE(check_name text, status text, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tables text[] := ARRAY['audit_logs','maintenances','installments','contracts','properties','tenants','property_photos','user_roles','asaas_accounts','asaas_customers','debt_agreements','inspections','crm_leads','crm_lead_notes','maintenance_messages','manager_members','profiles'];
  v_table text;
  v_rls boolean;
  v_count int;
  v_qual text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT relrowsecurity INTO v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=v_table;
    IF v_rls IS NULL THEN
      RETURN QUERY SELECT format('rls.%s', v_table), 'SKIP', 'table not found';
    ELSIF NOT v_rls THEN
      RAISE EXCEPTION 'RLS NOT ENABLED on public.%', v_table;
    ELSE
      RETURN QUERY SELECT format('rls.%s', v_table), 'OK', 'rls enabled';
    END IF;
  END LOOP;

  -- audit_logs: SELECT policy requires manager OR owner
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs' AND cmd='SELECT'
    AND qual LIKE '%has_role%manager%' AND qual LIKE '%has_role%owner%';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'audit_logs SELECT policy must require manager or owner role';
  END IF;
  RETURN QUERY SELECT 'audit_logs.select_policy', 'OK', 'manager/owner only';

  -- audit_logs: no anon policies
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs' AND 'anon' = ANY(roles);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'audit_logs must NOT have any anon policies';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_anon_policy', 'OK', 'no anon policies';

  -- audit_logs: no INSERT/UPDATE/DELETE/ALL policies (writes via service_role only)
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs'
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'audit_logs must not expose write policies to authenticated';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_write_policies', 'OK', 'writes via service_role only';

  -- audit_logs: anon must NOT have INSERT/UPDATE/DELETE table privileges
  IF has_table_privilege('anon','public.audit_logs','INSERT')
     OR has_table_privilege('anon','public.audit_logs','UPDATE')
     OR has_table_privilege('anon','public.audit_logs','DELETE') THEN
    RAISE EXCEPTION 'audit_logs must not grant write privileges to anon';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_anon_write_grant', 'OK', 'anon has no write grants';

  -- authenticated must NOT have INSERT/UPDATE/DELETE on audit_logs
  IF has_table_privilege('authenticated','public.audit_logs','INSERT')
     OR has_table_privilege('authenticated','public.audit_logs','UPDATE')
     OR has_table_privilege('authenticated','public.audit_logs','DELETE') THEN
    RAISE EXCEPTION 'audit_logs must not grant write privileges to authenticated';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_authenticated_write_grant', 'OK', 'authenticated has no write grants';

  -- Cross-tenant isolation
  FOR v_table, v_qual IN
    SELECT tablename, qual FROM pg_policies
    WHERE schemaname='public'
      AND tablename = ANY(ARRAY['maintenances','installments','contracts','properties','tenants','property_photos'])
      AND cmd IN ('SELECT','UPDATE','DELETE','ALL')
  LOOP
    IF v_qual IS NULL THEN
      RAISE EXCEPTION 'Open policy on %: NULL USING clause', v_table;
    END IF;
    IF v_qual NOT LIKE '%auth.uid()%'
       AND v_qual NOT LIKE '%current_tenant_id()%'
       AND v_qual NOT LIKE '%current_manager_id()%'
       AND v_qual NOT LIKE '%has_role%' THEN
      RAISE EXCEPTION 'Policy on % is not scoped by user/tenant/manager: %', v_table, v_qual;
    END IF;
  END LOOP;
  RETURN QUERY SELECT 'cross_tenant.scoping', 'OK', 'all policies scoped';

  -- user_roles: no authenticated write policies (no self-promotion)
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='user_roles'
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND 'authenticated' = ANY(roles);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'user_roles must not allow authenticated writes (privilege escalation risk)';
  END IF;
  RETURN QUERY SELECT 'user_roles.no_self_write', 'OK', 'no authenticated write policies';

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_security_invariants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_invariants() TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.verify_security_invariants() LOOP
    RAISE NOTICE '[security] % => % (%)', r.check_name, r.status, r.details;
  END LOOP;
END $$;
