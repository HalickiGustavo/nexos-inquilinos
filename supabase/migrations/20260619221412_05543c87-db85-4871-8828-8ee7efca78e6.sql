
-- Owner/manager: full access to their contracts' files (path layout: <contract_id>/<filename>)
CREATE POLICY "contracts_pdf_owner_all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND c.user_id = auth.uid()
  )
);

-- Tenant: read-only access to PDF of their own contract
CREATE POLICY "contracts_pdf_tenant_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1
    FROM public.contracts c
    JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND t.user_id_link = auth.uid()
  )
);
