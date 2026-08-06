-- 1. Ativar extensão necessária para busca textual (trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tentar criar o índice novamente após garantir a extensão
CREATE INDEX IF NOT EXISTS idx_tenants_full_name_trgm ON public.tenants USING gin (full_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- 3. Reaplica as políticas de service_role para tabelas de eventos (caso a falha anterior tenha abortado a transação)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stark_events' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON public.stark_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'efi_events' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON public.efi_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
