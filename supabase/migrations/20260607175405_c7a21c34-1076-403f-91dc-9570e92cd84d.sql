
CREATE POLICY "Owner manages own inspection files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'inspections' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'inspections' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Tenant reads own inspection files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspections'
  AND EXISTS (
    SELECT 1 FROM public.inspections i
    JOIN public.contracts c ON c.id = i.contract_id
    WHERE i.pdf_path = storage.objects.name
      AND c.tenant_id = public.current_tenant_id()
  )
);
