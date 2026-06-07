
-- Asaas subaccounts (one per owner / imobiliaria)
CREATE TABLE public.asaas_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  asaas_account_id text,
  wallet_id text,
  api_key text,
  status text NOT NULL DEFAULT 'pending',
  onboarding_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_accounts TO authenticated;
GRANT ALL ON public.asaas_accounts TO service_role;
ALTER TABLE public.asaas_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own asaas account" ON public.asaas_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_asaas_accounts_updated_at BEFORE UPDATE ON public.asaas_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Asaas customer per tenant
CREATE TABLE public.asaas_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL UNIQUE,
  asaas_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_customers TO authenticated;
GRANT ALL ON public.asaas_customers TO service_role;
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own asaas customers" ON public.asaas_customers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_asaas_customers_updated_at BEFORE UPDATE ON public.asaas_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend installments with Asaas payment data
ALTER TABLE public.installments
  ADD COLUMN asaas_payment_id text UNIQUE,
  ADD COLUMN boleto_url text,
  ADD COLUMN pix_qrcode text,
  ADD COLUMN pix_payload text,
  ADD COLUMN barcode text;

CREATE INDEX idx_installments_asaas_payment_id ON public.installments(asaas_payment_id);
