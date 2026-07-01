
-- =========================================================
-- STARK BANK MIGRATION
-- =========================================================

-- Cleanup legacy Efí artifacts (safe if absent)
DROP TABLE IF EXISTS public.efi_payouts CASCADE;
ALTER TABLE IF EXISTS public.asaas_accounts DROP COLUMN IF EXISTS efi_account_number;
ALTER TABLE IF EXISTS public.agency_settings DROP COLUMN IF EXISTS agency_efi_account_number;
ALTER TABLE IF EXISTS public.agency_settings DROP COLUMN IF EXISTS efi_account_number;

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.stark_charge_kind AS ENUM ('pix', 'boleto', 'pix_boleto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stark_charge_status AS ENUM ('created', 'paid', 'expired', 'canceled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_transfer_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_recipient_type AS ENUM ('nexo', 'agency', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- STARK CHARGES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.stark_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  manager_user_id UUID NOT NULL,
  kind public.stark_charge_kind NOT NULL DEFAULT 'pix',
  status public.stark_charge_status NOT NULL DEFAULT 'created',
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE,
  txid TEXT,
  stark_id TEXT,
  stark_boleto_id TEXT,
  brcode TEXT,
  qrcode_image_url TEXT,
  boleto_line TEXT,
  boleto_barcode TEXT,
  boleto_pdf_url TEXT,
  external_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stark_charges_installment ON public.stark_charges(installment_id);
CREATE INDEX IF NOT EXISTS idx_stark_charges_status ON public.stark_charges(status);
CREATE INDEX IF NOT EXISTS idx_stark_charges_stark_id ON public.stark_charges(stark_id);

GRANT SELECT ON public.stark_charges TO authenticated;
GRANT ALL ON public.stark_charges TO service_role;

ALTER TABLE public.stark_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stark_charges_select_manager" ON public.stark_charges
  FOR SELECT TO authenticated
  USING (manager_user_id = public.current_manager_id());

CREATE POLICY "stark_charges_select_tenant" ON public.stark_charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.contracts c ON c.id = i.contract_id
      WHERE i.id = stark_charges.installment_id
        AND c.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY "stark_charges_select_landlord" ON public.stark_charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.contracts c ON c.id = i.contract_id
      JOIN public.properties p ON p.id = c.property_id
      WHERE i.id = stark_charges.installment_id
        AND p.landlord_id = public.current_landlord_id()
    )
  );

CREATE TRIGGER trg_stark_charges_updated_at
  BEFORE UPDATE ON public.stark_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PAYMENT TRANSFERS (queue)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  manager_user_id UUID NOT NULL,
  recipient_type public.payment_recipient_type NOT NULL,
  recipient_user_id UUID,
  pix_key TEXT,
  pix_key_type TEXT,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  status public.payment_transfer_status NOT NULL DEFAULT 'PENDING',
  stark_transfer_id TEXT,
  external_id TEXT UNIQUE,
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.payment_transfers(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_transfers_installment ON public.payment_transfers(installment_id);
CREATE INDEX IF NOT EXISTS idx_transfers_manager ON public.payment_transfers(manager_user_id);

GRANT SELECT ON public.payment_transfers TO authenticated;
GRANT ALL ON public.payment_transfers TO service_role;

ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select_manager" ON public.payment_transfers
  FOR SELECT TO authenticated
  USING (manager_user_id = public.current_manager_id());

CREATE POLICY "transfers_select_recipient" ON public.payment_transfers
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- STARK EVENTS (webhook idempotency log)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.stark_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  subscription TEXT NOT NULL,
  log_type TEXT,
  raw JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stark_events_subscription ON public.stark_events(subscription);
CREATE INDEX IF NOT EXISTS idx_stark_events_processed ON public.stark_events(processed_at);

GRANT ALL ON public.stark_events TO service_role;
-- no authenticated grants — server-only

ALTER TABLE public.stark_events ENABLE ROW LEVEL SECURITY;
-- deny-all by omission for authenticated

-- =========================================================
-- INSTALLMENTS FK
-- =========================================================
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS stark_charge_id UUID REFERENCES public.stark_charges(id) ON DELETE SET NULL;
