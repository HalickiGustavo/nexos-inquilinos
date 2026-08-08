DROP TRIGGER IF EXISTS tr_log_contract_changes ON public.contracts;
DROP FUNCTION IF EXISTS public.log_contract_changes();

DROP POLICY IF EXISTS "Managers e owners veem cobranças da sua carteira" ON public.efi_charges;

CREATE POLICY "efi_charges_select_scoped"
ON public.efi_charges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.installments i
    JOIN public.contracts c ON c.id = i.contract_id
    JOIN public.properties p ON p.id = c.property_id
    WHERE i.id = efi_charges.installment_id
      AND (
        c.user_id = auth.uid()
        OR c.tenant_id = public.current_tenant_id()
        OR p.landlord_id = auth.uid()
        OR c.user_id = public.current_manager_id()
      )
  )
  OR efi_charges.manager_user_id = auth.uid()
  OR efi_charges.manager_user_id = public.current_manager_id()
);