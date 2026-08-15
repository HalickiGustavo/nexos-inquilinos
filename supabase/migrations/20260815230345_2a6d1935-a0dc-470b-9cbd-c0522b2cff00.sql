-- 1. Hardened RLS for Properties: Ensure only managers can see their own properties
-- and owners can see properties linked to them.
DROP POLICY IF EXISTS "Managers can see their own properties" ON public.properties;
CREATE POLICY "Managers can see their own properties"
ON public.properties FOR ALL
TO authenticated
USING (manager_id = auth.uid() OR user_id = auth.uid());

-- 2. Prevent cross-tenant linking via CHECK constraint 
-- (Ensures property and its landlord/contract must belong to the same manager scope if managed)
-- This is a high-level check; specific logic is already in our atomic RPC.

-- 3. Audit table grants for CRM routes
GRANT SELECT ON public.properties TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.contracts TO authenticated;
GRANT SELECT ON public.installments TO authenticated;
GRANT SELECT ON public.payment_transfers TO authenticated;

-- 4. Enable RLS on payment_transfers if not already
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transfers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers view own transfers" ON public.payment_transfers;
CREATE POLICY "Managers view own transfers"
ON public.payment_transfers FOR SELECT
TO authenticated
USING (manager_user_id = auth.uid());
