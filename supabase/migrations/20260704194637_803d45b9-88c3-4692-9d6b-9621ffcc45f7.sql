
-- Allow tenants to read documents linked to their active contract, and to download the underlying files.

CREATE POLICY "Tenants read documents of their contract"
ON public.documents
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND contract_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = documents.contract_id
      AND c.tenant_id = public.current_tenant_id()
      AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Tenants read documents storage of their contract"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.contracts c ON c.id = d.contract_id
    WHERE d.storage_path = storage.objects.name
      AND d.deleted_at IS NULL
      AND c.tenant_id = public.current_tenant_id()
      AND c.deleted_at IS NULL
  )
);
