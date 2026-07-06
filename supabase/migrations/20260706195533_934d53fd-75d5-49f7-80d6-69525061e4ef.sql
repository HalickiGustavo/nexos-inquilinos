DROP POLICY IF EXISTS "Landlord updates own inspections" ON public.inspections;
CREATE POLICY "Landlord updates own inspections" ON public.inspections
FOR UPDATE
USING (
  (user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id AND p.landlord_id = auth.uid()
  )
)
WITH CHECK (
  (user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id AND p.landlord_id = auth.uid()
  )
);