-- 1. Contracts policies: scope to authenticated role
DROP POLICY IF EXISTS "Manager sees contracts of managed properties" ON public.contracts;
CREATE POLICY "Manager sees contracts of managed properties"
ON public.contracts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "Manager updates contracts of managed properties" ON public.contracts;
CREATE POLICY "Manager updates contracts of managed properties"
ON public.contracts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
);

-- 2. Fix mutable search_path on email queue helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, pg_temp;