
-- 1) Novo status no enum installment_status
ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'acordo_fechado';

-- 2) Tabela debt_agreements
CREATE TABLE IF NOT EXISTS public.debt_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_total numeric(12,2) NOT NULL,
  late_fee_percent numeric(6,2) NOT NULL DEFAULT 0,
  interest_percent numeric(6,2) NOT NULL DEFAULT 0,
  installments_count integer NOT NULL CHECK (installments_count BETWEEN 1 AND 36),
  total_amount numeric(12,2) NOT NULL,
  first_due_date date NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_agreements TO authenticated;
GRANT ALL ON public.debt_agreements TO service_role;

ALTER TABLE public.debt_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own debt agreements select"
  ON public.debt_agreements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Own debt agreements insert"
  ON public.debt_agreements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own debt agreements update"
  ON public.debt_agreements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Own debt agreements delete"
  ON public.debt_agreements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Tenant views own debt agreements"
  ON public.debt_agreements FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_debt_agreements_updated
  BEFORE UPDATE ON public.debt_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_debt_agreements_contract ON public.debt_agreements(contract_id);
CREATE INDEX IF NOT EXISTS idx_debt_agreements_tenant ON public.debt_agreements(tenant_id);

-- 3) Vínculo parcelas <-> acordo
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS debt_agreement_id uuid REFERENCES public.debt_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_installments_debt_agreement ON public.installments(debt_agreement_id);
