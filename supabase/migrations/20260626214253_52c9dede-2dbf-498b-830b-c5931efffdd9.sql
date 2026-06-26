
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS agency_pix_key text,
  ADD COLUMN IF NOT EXISTS agency_pix_key_type text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS owner_pix_key text,
  ADD COLUMN IF NOT EXISTS owner_pix_key_type text;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS agency_admin_fee_percentage numeric(5,2) NOT NULL DEFAULT 10;

INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('nexo_platform_pix_key', '', 'Chave Pix da plataforma Nexo'),
  ('nexo_platform_pix_key_type', 'EVP', 'Tipo da chave Pix Nexo'),
  ('nexo_flat_fee', '24.99', 'Taxa fixa Nexo por parcela (R$)')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pix_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mock',
  nexo_amount numeric(12,2) NOT NULL DEFAULT 0,
  agency_amount numeric(12,2) NOT NULL DEFAULT 0,
  owner_amount numeric(12,2) NOT NULL DEFAULT 0,
  nexo_pix_key text,
  agency_pix_key text,
  owner_pix_key text,
  psp_txid text,
  psp_qrcode_base64 text,
  psp_pix_payload text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pix_splits_installment ON public.pix_splits(installment_id);
CREATE INDEX IF NOT EXISTS idx_pix_splits_user ON public.pix_splits(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_splits TO authenticated;
GRANT ALL ON public.pix_splits TO service_role;

ALTER TABLE public.pix_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager owns pix_splits" ON public.pix_splits
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant reads own pix_splits" ON public.pix_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.contracts c ON c.id = i.contract_id
      WHERE i.id = pix_splits.installment_id
        AND c.tenant_id = public.current_tenant_id()
        AND c.active
    )
  );

CREATE TRIGGER set_updated_at_pix_splits
  BEFORE UPDATE ON public.pix_splits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
