
ALTER TABLE public.pix_splits
  ADD COLUMN IF NOT EXISTS charge_type text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS boleto_barcode text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_scheduled_for date,
  ADD COLUMN IF NOT EXISTS payout_error text;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS boleto_barcode text,
  ADD COLUMN IF NOT EXISTS charge_provider text NOT NULL DEFAULT 'efi';

CREATE INDEX IF NOT EXISTS idx_pix_splits_payout_pending
  ON public.pix_splits (payout_status, payout_scheduled_for)
  WHERE payout_status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.efi_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pix_split_id uuid NOT NULL REFERENCES public.pix_splits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text NOT NULL CHECK (recipient IN ('agency','owner')),
  pix_key text NOT NULL,
  pix_key_type text,
  amount numeric(12,2) NOT NULL,
  e2e_id text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_efi_payouts_split ON public.efi_payouts (pix_split_id);
CREATE INDEX IF NOT EXISTS idx_efi_payouts_user ON public.efi_payouts (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.efi_payouts TO authenticated;
GRANT ALL ON public.efi_payouts TO service_role;

ALTER TABLE public.efi_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager owns efi_payouts"
  ON public.efi_payouts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Landlord reads efi_payouts of own properties"
  ON public.efi_payouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pix_splits ps
      JOIN public.installments i ON i.id = ps.installment_id
      JOIN public.contracts c ON c.id = i.contract_id
      JOIN public.properties p ON p.id = c.property_id
      WHERE ps.id = efi_payouts.pix_split_id
        AND p.landlord_id = auth.uid()
    )
  );
