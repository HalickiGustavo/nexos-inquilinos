-- Hardening RLS em tabelas com dados financeiros / PII do proprietário.
-- 1) Reforça asaas_accounts: policies por comando, somente authenticated,
--    REVOKE explícito de anon, e NOT NULL em user_id.

ALTER TABLE public.asaas_accounts ALTER COLUMN user_id SET NOT NULL;

REVOKE ALL ON public.asaas_accounts FROM anon;
REVOKE ALL ON public.asaas_accounts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_accounts TO authenticated;
GRANT ALL ON public.asaas_accounts TO service_role;

DROP POLICY IF EXISTS "Owner manages own asaas account" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_select_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_insert_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_update_own" ON public.asaas_accounts;
DROP POLICY IF EXISTS "asaas_accounts_delete_own" ON public.asaas_accounts;

CREATE POLICY "asaas_accounts_select_own"
  ON public.asaas_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "asaas_accounts_insert_own"
  ON public.asaas_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asaas_accounts_update_own"
  ON public.asaas_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asaas_accounts_delete_own"
  ON public.asaas_accounts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2) Mesmo tratamento para asaas_customers (contém CPF/Email/Telefone do inquilino
--    vinculado ao usuário dono da subconta).
ALTER TABLE public.asaas_customers ALTER COLUMN user_id SET NOT NULL;
REVOKE ALL ON public.asaas_customers FROM anon;
REVOKE ALL ON public.asaas_customers FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_customers TO authenticated;
GRANT ALL ON public.asaas_customers TO service_role;

DROP POLICY IF EXISTS "Owner manages own asaas customers" ON public.asaas_customers;
CREATE POLICY "asaas_customers_select_own"
  ON public.asaas_customers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "asaas_customers_insert_own"
  ON public.asaas_customers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asaas_customers_update_own"
  ON public.asaas_customers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "asaas_customers_delete_own"
  ON public.asaas_customers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3) profiles: garantir que anon não enxergue PII (nome, email, telefone).
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
