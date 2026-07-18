ALTER TABLE public.efi_events ADD COLUMN IF NOT EXISTS error TEXT;
CREATE INDEX IF NOT EXISTS idx_efi_events_unprocessed ON public.efi_events(received_at DESC) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_efi_charges_txid ON public.efi_charges(txid);
CREATE INDEX IF NOT EXISTS idx_efi_charges_installment_status ON public.efi_charges(installment_id, status);