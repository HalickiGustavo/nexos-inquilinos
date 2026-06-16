
-- 1) Maintenances: prevent tenants from forging user_id
DROP POLICY IF EXISTS "Tenant creates own maintenances" ON public.maintenances;
CREATE POLICY "Tenant creates own maintenances" ON public.maintenances
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = (SELECT t.user_id FROM public.tenants t WHERE t.id = public.current_tenant_id())
  );

-- 2) Storage: restrict property-images SELECT to authenticated users
DROP POLICY IF EXISTS "property-images public read" ON storage.objects;
CREATE POLICY "property-images authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'property-images');
