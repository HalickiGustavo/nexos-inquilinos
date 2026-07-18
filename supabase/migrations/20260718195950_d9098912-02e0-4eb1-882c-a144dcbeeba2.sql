
CREATE POLICY "Manager sees contracts of managed properties"
ON public.contracts FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contracts.property_id AND p.manager_id = auth.uid()
  )
);

CREATE POLICY "Manager updates contracts of managed properties"
ON public.contracts FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contracts.property_id AND p.manager_id = auth.uid()
  )
);
