
-- Add new inspection kinds (preventiva, extraordinaria)
ALTER TYPE public.inspection_kind ADD VALUE IF NOT EXISTS 'preventiva';
ALTER TYPE public.inspection_kind ADD VALUE IF NOT EXISTS 'extraordinaria';

-- Landlord access to inspections through property ownership
CREATE POLICY "Landlord views inspections of own properties"
ON public.inspections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlord inserts inspections for own properties"
ON public.inspections
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlord updates own inspections"
ON public.inspections
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
)
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Landlord deletes own draft inspections"
ON public.inspections
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND status = 'rascunho'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);
