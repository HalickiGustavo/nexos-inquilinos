-- Allow Landlords to update properties where they are the owner
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'properties' AND policyname = 'Landlords can update own properties'
    ) THEN
        CREATE POLICY "Landlords can update own properties" 
        ON public.properties 
        FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = landlord_id);
    END IF;
END $$;

GRANT UPDATE ON public.properties TO authenticated;
