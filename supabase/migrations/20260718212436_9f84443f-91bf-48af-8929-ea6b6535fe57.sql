
ALTER TABLE public.payment_transfers
  ADD COLUMN IF NOT EXISTS efi_id_envio TEXT,
  ADD COLUMN IF NOT EXISTS efi_e2e_id TEXT,
  ADD COLUMN IF NOT EXISTS efi_status TEXT,
  ADD COLUMN IF NOT EXISTS efi_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS efi_last_consult_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS efi_response JSONB,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_transfers_processing_retry
  ON public.payment_transfers (next_retry_at)
  WHERE status = 'PROCESSING';

CREATE INDEX IF NOT EXISTS idx_payment_transfers_efi_id_envio
  ON public.payment_transfers (efi_id_envio)
  WHERE efi_id_envio IS NOT NULL;
