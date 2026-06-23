
-- PIX no profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pix_key_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pix_key_type_check
  CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','email','phone','random'));

-- properties.landlord_id
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON public.properties(landlord_id);

-- landlord_invites
CREATE TABLE IF NOT EXISTS public.landlord_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  document text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','cancelado','expirado')),
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landlord_invites_manager ON public.landlord_invites(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_invites_email_lower ON public.landlord_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_landlord_invites_token ON public.landlord_invites(invite_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_invites TO authenticated;
GRANT ALL ON public.landlord_invites TO service_role;

ALTER TABLE public.landlord_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manager gerencia seus convites de proprietário" ON public.landlord_invites;
CREATE POLICY "Manager gerencia seus convites de proprietário"
ON public.landlord_invites FOR ALL
TO authenticated
USING (manager_user_id = auth.uid() AND public.has_role(auth.uid(), 'manager'))
WITH CHECK (manager_user_id = auth.uid() AND public.has_role(auth.uid(), 'manager'));

DROP TRIGGER IF EXISTS trg_landlord_invites_updated_at ON public.landlord_invites;
CREATE TRIGGER trg_landlord_invites_updated_at
BEFORE UPDATE ON public.landlord_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- landlord_withdrawals
CREATE TABLE IF NOT EXISTS public.landlord_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','processando','pago','falhou','cancelado')),
  asaas_transfer_id text,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landlord_withdrawals_user ON public.landlord_withdrawals(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_withdrawals_manager ON public.landlord_withdrawals(manager_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_withdrawals TO authenticated;
GRANT ALL ON public.landlord_withdrawals TO service_role;

ALTER TABLE public.landlord_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Proprietário vê seus saques" ON public.landlord_withdrawals;
CREATE POLICY "Proprietário vê seus saques"
ON public.landlord_withdrawals FOR SELECT
TO authenticated
USING (landlord_user_id = auth.uid() AND public.has_role(auth.uid(), 'landlord'));

DROP POLICY IF EXISTS "Proprietário cria saque para si" ON public.landlord_withdrawals;
CREATE POLICY "Proprietário cria saque para si"
ON public.landlord_withdrawals FOR INSERT
TO authenticated
WITH CHECK (landlord_user_id = auth.uid() AND public.has_role(auth.uid(), 'landlord'));

DROP POLICY IF EXISTS "Manager vê saques dos seus proprietários" ON public.landlord_withdrawals;
CREATE POLICY "Manager vê saques dos seus proprietários"
ON public.landlord_withdrawals FOR SELECT
TO authenticated
USING (manager_user_id = auth.uid() AND public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Manager atualiza saques dos seus proprietários" ON public.landlord_withdrawals;
CREATE POLICY "Manager atualiza saques dos seus proprietários"
ON public.landlord_withdrawals FOR UPDATE
TO authenticated
USING (manager_user_id = auth.uid() AND public.has_role(auth.uid(), 'manager'))
WITH CHECK (manager_user_id = auth.uid() AND public.has_role(auth.uid(), 'manager'));

DROP TRIGGER IF EXISTS trg_landlord_withdrawals_updated_at ON public.landlord_withdrawals;
CREATE TRIGGER trg_landlord_withdrawals_updated_at
BEFORE UPDATE ON public.landlord_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função: aceitar convite
CREATE OR REPLACE FUNCTION public.accept_landlord_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.landlord_invites%ROWTYPE;
  v_norm_doc text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.landlord_invites
  WHERE invite_token = _token AND status = 'pendente'
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_used_token';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'landlord'::app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.landlord_invites
     SET status = 'aceito', accepted_user_id = auth.uid(), accepted_at = now()
   WHERE id = v_invite.id;

  v_norm_doc := regexp_replace(coalesce(v_invite.document, ''), '\D', '', 'g');

  IF length(v_norm_doc) >= 11 THEN
    UPDATE public.properties p
       SET landlord_id = auth.uid()
     WHERE p.user_id = v_invite.manager_user_id
       AND p.landlord_id IS NULL
       AND (
         regexp_replace(coalesce(p.owner_doc, ''), '\D', '', 'g') = v_norm_doc
         OR coalesce(p.notes, '') LIKE '%' || v_norm_doc || '%'
       );
  END IF;

  RETURN v_invite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_landlord_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;

-- Helper
CREATE OR REPLACE FUNCTION public.current_landlord_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(auth.uid(), 'landlord') THEN auth.uid() ELSE NULL END
$$;

REVOKE ALL ON FUNCTION public.current_landlord_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_landlord_id() TO authenticated;

-- Policies de leitura para landlord
DROP POLICY IF EXISTS "Landlord vê seus imóveis" ON public.properties;
CREATE POLICY "Landlord vê seus imóveis"
ON public.properties FOR SELECT
TO authenticated
USING (landlord_id = auth.uid() AND public.has_role(auth.uid(), 'landlord'));

DROP POLICY IF EXISTS "Landlord vê contratos dos seus imóveis" ON public.contracts;
CREATE POLICY "Landlord vê contratos dos seus imóveis"
ON public.contracts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contracts.property_id AND p.landlord_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Landlord vê parcelas dos seus imóveis" ON public.installments;
CREATE POLICY "Landlord vê parcelas dos seus imóveis"
ON public.installments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = installments.contract_id AND p.landlord_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Landlord vê manutenções dos seus imóveis" ON public.maintenances;
CREATE POLICY "Landlord vê manutenções dos seus imóveis"
ON public.maintenances FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = maintenances.property_id AND p.landlord_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Landlord vê inquilinos dos seus contratos" ON public.tenants;
CREATE POLICY "Landlord vê inquilinos dos seus contratos"
ON public.tenants FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'landlord')
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.tenant_id = tenants.id AND p.landlord_id = auth.uid()
  )
);
