
ALTER TABLE public.asaas_accounts
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS kyc_reference_id text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_digit text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS auto_transfer_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.asaas_accounts
  ADD CONSTRAINT asaas_accounts_kyc_status_chk
  CHECK (kyc_status IN ('PENDENTE','EM_ANALISE','APROVADO','REJEITADO'));
