-- Defense-in-depth hardening after cross-account data exposure report.
-- Goal: no browser/user role can read or mutate another user's sensitive rows,
-- even if a query is written too broadly or a legacy grant exists.

-- 1) Remove legacy/public table grants from non-application roles.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- sandbox_exec has BYPASSRLS in this project; it must never keep direct access
-- to tenant/landlord/financial application tables.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM sandbox_exec;

-- 2) Force RLS on every user/business table. Service-role jobs still work
-- through BYPASSRLS, but table-owner accidental bypass is prevented.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agency_settings',
    'asaas_accounts',
    'asaas_customers',
    'audit_logs',
    'contracts',
    'crm_lead_notes',
    'crm_leads',
    'debt_agreements',
    'inspections',
    'installment_notifications',
    'installments',
    'landlord_invites',
    'landlord_withdrawals',
    'maintenance_messages',
    'maintenance_response_notifications',
    'maintenances',
    'manager_members',
    'profiles',
    'properties',
    'property_photos',
    'tenants',
    'user_roles'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 3) Recreate the most sensitive owner-scoped policies with explicit auth.uid()
-- predicates. These policies intentionally do not include manager/landlord joins.
DROP POLICY IF EXISTS "asaas_accounts_select_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_insert_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_update_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_delete_own" ON public.asaas_accounts;

CREATE POLICY "asaas_accounts_select_own"
  ON public.asaas_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "asaas_accounts_insert_own"
  ON public.asaas_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "asaas_accounts_update_own"
  ON public.asaas_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "asaas_accounts_delete_own"
  ON public.asaas_accounts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "asaas_customers_select_own" ON public.asaas_customers;
DROP POLICY IF EXISTS "asaas_customers_insert_own" ON public.asaas_customers;
DROP POLICY IF EXISTS "asaas_customers_update_own" ON public.asaas_customers;
DROP POLICY IF EXISTS "asaas_customers_delete_own" ON public.asaas_customers;

CREATE POLICY "asaas_customers_select_own"
  ON public.asaas_customers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "asaas_customers_insert_own"
  ON public.asaas_customers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "asaas_customers_update_own"
  ON public.asaas_customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "asaas_customers_delete_own"
  ON public.asaas_customers FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4) Keep only the minimum function surface callable by logged-in users.
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_manager_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_landlord_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_manager_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_manager_invite(text) TO authenticated;

-- 5) Preserve normal app access for authenticated users; RLS decides the rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
