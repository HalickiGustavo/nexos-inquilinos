
-- Documento (CPF/CNPJ) do proprietário/usuário, necessário para repasse Asaas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS document_type text;

-- Controle do repasse diário ao proprietário
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS landlord_payout_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS landlord_payout_amount numeric,
  ADD COLUMN IF NOT EXISTS landlord_payout_date timestamptz,
  ADD COLUMN IF NOT EXISTS landlord_payout_asaas_id text,
  ADD COLUMN IF NOT EXISTS landlord_payout_error text;

CREATE INDEX IF NOT EXISTS idx_installments_landlord_payout_pending
  ON public.installments(status, landlord_payout_status)
  WHERE status = 'pago' AND landlord_payout_status = 'pendente';
