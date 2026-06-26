-- Harden user-scoped financial and landlord data isolation.
-- No new tables are created in this migration.

REVOKE ALL ON TABLE public.landlord_withdrawals FROM anon;
REVOKE ALL ON TABLE public.asaas_accounts FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.properties FROM anon;
REVOKE ALL ON TABLE public.contracts FROM anon;
REVOKE ALL ON TABLE public.installments FROM anon;
REVOKE ALL ON TABLE public.maintenances FROM anon;

ALTER TABLE public.asaas_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_withdrawals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.asaas_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.installments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_withdrawals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_accounts_select_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_insert_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_update_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_delete_own" ON public.asaas_accounts;

CREATE POLICY "asaas_accounts_select_own"
ON public.asaas_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "asaas_accounts_insert_own"
ON public.asaas_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "asaas_accounts_update_own"
ON public.asaas_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "asaas_accounts_delete_own"
ON public.asaas_accounts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_accounts TO authenticated;
GRANT ALL ON public.asaas_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenances TO authenticated;
GRANT ALL ON public.maintenances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_withdrawals TO authenticated;
GRANT ALL ON public.landlord_withdrawals TO service_role;