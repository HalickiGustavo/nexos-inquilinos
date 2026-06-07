
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id
  FROM public.tenants t
  WHERE t.user_id_link = auth.uid()
    AND public.has_role(auth.uid(), 'tenant')
  LIMIT 1
$$;

CREATE POLICY "Tenant views own tenant record"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = public.current_tenant_id());
