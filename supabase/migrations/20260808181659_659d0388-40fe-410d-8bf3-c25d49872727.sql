-- Criação da política de inserção para gerentes (imobiliárias)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contracts' 
        AND policyname = 'Managers can insert contracts for their properties'
    ) THEN
        CREATE POLICY "Managers can insert contracts for their properties"
        ON public.contracts FOR INSERT TO authenticated
        WITH CHECK (
            has_role(auth.uid(), 'manager'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.properties p 
                WHERE p.id = property_id 
                AND p.manager_id = auth.uid()
            )
        );
    END IF;
END $$;
