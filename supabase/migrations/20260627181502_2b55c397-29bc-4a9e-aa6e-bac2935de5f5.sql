
-- 1. Add deleted_at columns
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tenants_not_deleted_idx ON public.tenants (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contracts_not_deleted_idx ON public.contracts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contracts_property_not_deleted_idx ON public.contracts (property_id) WHERE deleted_at IS NULL;

-- 2. Replace CASCADE with RESTRICT on contracts.tenant_id to protect history
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_tenant_id_fkey;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
