-- Allow Landlords to update properties where they are the owner
CREATE POLICY "Landlords can update own properties" 
ON public.properties 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = landlord_id);

GRANT UPDATE ON public.properties TO authenticated;
