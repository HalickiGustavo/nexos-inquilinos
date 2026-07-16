
CREATE TABLE IF NOT EXISTS public.efi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.efi_events TO service_role;
ALTER TABLE public.efi_events ENABLE ROW LEVEL SECURITY;
-- No policies: writes/reads only via service_role (webhook + workers).

CREATE TABLE IF NOT EXISTS public.efi_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid REFERENCES public.installments(id) ON DELETE CASCADE,
  manager_user_id uuid,
  kind text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'created',
  amount numeric NOT NULL,
  txid text UNIQUE,
  loc_id bigint,
  brcode text,
  qrcode_image_base64 text,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS efi_charges_installment_idx ON public.efi_charges(installment_id);
GRANT SELECT ON public.efi_charges TO authenticated;
GRANT ALL ON public.efi_charges TO service_role;
ALTER TABLE public.efi_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers e owners veem cobranças da sua carteira"
ON public.efi_charges FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'landlord')
  OR EXISTS (
    SELECT 1 FROM public.installments i
    JOIN public.contracts c ON c.id = i.contract_id
    WHERE i.id = efi_charges.installment_id
      AND (c.user_id = auth.uid() OR c.tenant_id = public.current_tenant_id())
  )
);

CREATE TRIGGER efi_charges_updated_at
BEFORE UPDATE ON public.efi_charges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
