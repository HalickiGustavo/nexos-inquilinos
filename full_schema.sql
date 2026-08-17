
-- Enums
CREATE TYPE public.property_type AS ENUM ('casa', 'apartamento', 'comercial', 'terreno', 'outro');
CREATE TYPE public.property_status AS ENUM ('disponivel', 'alugado', 'manutencao');
CREATE TYPE public.readjustment_index AS ENUM ('IGP-M', 'IPCA', 'INCC', 'nenhum');
CREATE TYPE public.installment_status AS ENUM ('pendente', 'pago', 'atrasado');
CREATE TYPE public.maintenance_status AS ENUM ('pendente', 'em_andamento', 'concluido');
CREATE TYPE public.maintenance_responsible AS ENUM ('proprietario', 'inquilino');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  type public.property_type NOT NULL DEFAULT 'apartamento',
  rent_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  condo_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  iptu NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.property_status NOT NULL DEFAULT 'disponivel',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own properties select" ON public.properties FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own properties insert" ON public.properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own properties update" ON public.properties FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own properties delete" ON public.properties FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own tenants select" ON public.tenants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own tenants insert" ON public.tenants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tenants update" ON public.tenants FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own tenants delete" ON public.tenants FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  rent_amount NUMERIC(12,2) NOT NULL,
  readjustment_index public.readjustment_index NOT NULL DEFAULT 'IGP-M',
  security_deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own contracts select" ON public.contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own contracts insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own contracts update" ON public.contracts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own contracts delete" ON public.contracts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Installments
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  extra_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ,
  status public.installment_status NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own installments select" ON public.installments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own installments insert" ON public.installments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own installments update" ON public.installments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own installments delete" ON public.installments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_installments_due_date ON public.installments(due_date);
CREATE INDEX idx_installments_status ON public.installments(status);

-- Maintenances
CREATE TABLE public.maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.maintenance_status NOT NULL DEFAULT 'pendente',
  responsible public.maintenance_responsible NOT NULL DEFAULT 'proprietario',
  scheduled_date DATE,
  completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenances TO authenticated;
GRANT ALL ON public.maintenances TO service_role;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own maintenances select" ON public.maintenances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own maintenances insert" ON public.maintenances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own maintenances update" ON public.maintenances FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own maintenances delete" ON public.maintenances FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_installments_updated BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_maintenances_updated BEFORE UPDATE ON public.maintenances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate installments when contract is created
CREATE OR REPLACE FUNCTION public.generate_installments_for_contract()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  months_count INT;
  i INT;
  due DATE;
  base_date DATE;
  max_day INT;
  use_day INT;
BEGIN
  months_count := (EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12
                  + EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date)))::INT;
  IF months_count < 1 THEN months_count := 1; END IF;

  FOR i IN 0..(months_count - 1) LOOP
    base_date := (date_trunc('month', NEW.start_date) + (i || ' month')::interval)::date;
    max_day := EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int;
    use_day := LEAST(NEW.due_day, max_day);
    due := make_date(EXTRACT(YEAR FROM base_date)::int, EXTRACT(MONTH FROM base_date)::int, use_day);

    INSERT INTO public.installments (user_id, contract_id, due_date, amount, status)
    VALUES (NEW.user_id, NEW.id, due, NEW.rent_amount, 'pendente');
  END LOOP;

  -- Mark property as rented
  UPDATE public.properties SET status = 'alugado' WHERE id = NEW.property_id AND user_id = NEW.user_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_generate_installments
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.generate_installments_for_contract();

ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments_for_contract() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('owner', 'tenant');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. Link tenants to auth users
ALTER TABLE public.tenants ADD COLUMN user_id_link uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_tenants_user_id_link ON public.tenants(user_id_link);

-- helper: get tenant_id for current auth user
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE user_id_link = auth.uid() LIMIT 1
$$;

-- 3. Tenant access to contracts/installments/properties/maintenances
CREATE POLICY "Tenant views own contract" ON public.contracts
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant views own installments" ON public.installments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = installments.contract_id AND c.tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant views rented property" ON public.properties
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.property_id = properties.id AND c.tenant_id = public.current_tenant_id() AND c.active)
  );

-- maintenances: add tenant_id link
ALTER TABLE public.maintenances ADD COLUMN tenant_id uuid;

CREATE POLICY "Tenant views own maintenances" ON public.maintenances
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant creates own maintenances" ON public.maintenances
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant updates own maintenances" ON public.maintenances
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());

-- 4. Maintenance chat messages
CREATE TABLE public.maintenance_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES public.maintenances(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mm_maintenance ON public.maintenance_messages(maintenance_id, created_at);

GRANT SELECT, INSERT ON public.maintenance_messages TO authenticated;
GRANT ALL ON public.maintenance_messages TO service_role;

ALTER TABLE public.maintenance_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view messages" ON public.maintenance_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id = maintenance_messages.maintenance_id
        AND (m.user_id = auth.uid() OR m.tenant_id = public.current_tenant_id())
    )
  );

CREATE POLICY "Participants send messages" ON public.maintenance_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id = maintenance_messages.maintenance_id
        AND (m.user_id = auth.uid() OR m.tenant_id = public.current_tenant_id())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_messages;
ALTER TABLE public.maintenance_messages REPLICA IDENTITY FULL;

-- 5. Default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- backfill: existing users without roles become owners
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id
  FROM public.tenants t
  WHERE t.user_id_link = auth.uid()
    AND public.has_role(auth.uid(), 'tenant')
  LIMIT 1
$$;

CREATE POLICY "Tenant views own tenant record"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = public.current_tenant_id());
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
CREATE TABLE public.efi_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  wallet_id text,
  api_key text,
  status text NOT NULL DEFAULT 'pending',
  onboarding_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.efi_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own efi_account" ON public.efi_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_efi_accounts_updated BEFORE UPDATE ON public.efi_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.efi_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.efi_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own efi_credentials" ON public.efi_credentials
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_efi_credentials_updated BEFORE UPDATE ON public.efi_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.installments
  ADD COLUMN boleto_url text,
  ADD COLUMN pix_qrcode text,
  ADD COLUMN pix_payload text,
  ADD COLUMN barcode text;



-- 2) Lock down trigger functions that should never be callable directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments_for_contract() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS late_fee_percent numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS daily_interest_percent numeric NOT NULL DEFAULT 0.033;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS late_charges numeric NOT NULL DEFAULT 0;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
-- manager_members
CREATE TABLE public.manager_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  member_user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  role_label text NOT NULL DEFAULT 'corretor',
  invite_token text UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_members TO authenticated;
GRANT ALL ON public.manager_members TO service_role;
ALTER TABLE public.manager_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager manages own team" ON public.manager_members
  FOR ALL TO authenticated USING (auth.uid() = manager_user_id) WITH CHECK (auth.uid() = manager_user_id);
CREATE POLICY "Member views own membership" ON public.manager_members
  FOR SELECT TO authenticated USING (auth.uid() = member_user_id);
CREATE TRIGGER set_updated_at_manager_members BEFORE UPDATE ON public.manager_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- current_manager_id helper
CREATE OR REPLACE FUNCTION public.current_manager_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'manager') THEN auth.uid()
    ELSE (SELECT manager_user_id FROM public.manager_members
          WHERE member_user_id = auth.uid() AND status = 'ativo' LIMIT 1)
  END
$$;

-- properties extras
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS manager_id uuid,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_commission_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS assigned_member_id uuid,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS code text;

CREATE OR REPLACE FUNCTION public.set_property_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'IM-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_property_code_trg ON public.properties;
CREATE TRIGGER set_property_code_trg BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_property_code();
UPDATE public.properties SET code = 'IM-' || upper(substr(replace(id::text, '-', ''), 1, 6)) WHERE code IS NULL;

CREATE POLICY "Manager views portfolio properties" ON public.properties
  FOR SELECT TO authenticated
  USING (manager_id IS NOT NULL AND manager_id = public.current_manager_id());

-- installments extras
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS management_fee_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'aguardando',
  ADD COLUMN IF NOT EXISTS payout_date timestamptz;

-- crm_leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  budget numeric NOT NULL DEFAULT 0,
  interested_property_id uuid,
  interested_code text,
  stage text NOT NULL DEFAULT 'novos',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager manages own leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (manager_user_id = public.current_manager_id())
  WITH CHECK (manager_user_id = public.current_manager_id());
CREATE TRIGGER set_updated_at_crm_leads BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- crm_lead_notes
CREATE TABLE public.crm_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_notes TO authenticated;
GRANT ALL ON public.crm_lead_notes TO service_role;
ALTER TABLE public.crm_lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager manages own lead notes" ON public.crm_lead_notes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id AND l.manager_user_id = public.current_manager_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id AND l.manager_user_id = public.current_manager_id()));

REVOKE EXECUTE ON FUNCTION public.current_manager_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_manager_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS variable_expenses jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS default_management_fee_percent numeric NOT NULL DEFAULT 10;

CREATE TYPE public.inspection_kind AS ENUM ('entrada', 'saida');
CREATE TYPE public.inspection_condition AS ENUM ('otimo', 'bom', 'regular', 'ruim');
CREATE TYPE public.inspection_status AS ENUM ('rascunho', 'assinada');

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  kind public.inspection_kind NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name text,
  general_condition public.inspection_condition NOT NULL DEFAULT 'bom',
  rooms jsonb NOT NULL DEFAULT '[]'::jsonb,
  observations text,
  pdf_path text,
  status public.inspection_status NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own inspections select" ON public.inspections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own inspections insert" ON public.inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own inspections update" ON public.inspections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own inspections delete" ON public.inspections FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Tenant views own inspections" ON public.inspections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = inspections.contract_id AND c.tenant_id = public.current_tenant_id()));

CREATE TRIGGER set_inspections_updated_at BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX inspections_contract_idx ON public.inspections(contract_id);
CREATE INDEX inspections_user_idx ON public.inspections(user_id);

CREATE POLICY "Owner manages own inspection files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'inspections' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'inspections' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Tenant reads own inspection files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspections'
  AND EXISTS (
    SELECT 1 FROM public.inspections i
    JOIN public.contracts c ON c.id = i.contract_id
    WHERE i.pdf_path = storage.objects.name
      AND c.tenant_id = public.current_tenant_id()
  )
);

ALTER TABLE public.maintenances
  ADD COLUMN budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN budget_status text NOT NULL DEFAULT 'nenhum',
  ADD COLUMN budget_rent_deduction boolean NOT NULL DEFAULT false,
  ADD COLUMN budget_notes text,
  ADD COLUMN budget_decided_at timestamptz,
  ADD COLUMN budget_applied_installment_id uuid;

-- 1) Novo status no enum installment_status
ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'acordo_fechado';

-- 2) Tabela debt_agreements
CREATE TABLE IF NOT EXISTS public.debt_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_total numeric(12,2) NOT NULL,
  late_fee_percent numeric(6,2) NOT NULL DEFAULT 0,
  interest_percent numeric(6,2) NOT NULL DEFAULT 0,
  installments_count integer NOT NULL CHECK (installments_count BETWEEN 1 AND 36),
  total_amount numeric(12,2) NOT NULL,
  first_due_date date NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_agreements TO authenticated;
GRANT ALL ON public.debt_agreements TO service_role;

ALTER TABLE public.debt_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own debt agreements select"
  ON public.debt_agreements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Own debt agreements insert"
  ON public.debt_agreements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own debt agreements update"
  ON public.debt_agreements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Own debt agreements delete"
  ON public.debt_agreements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Tenant views own debt agreements"
  ON public.debt_agreements FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_debt_agreements_updated
  BEFORE UPDATE ON public.debt_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_debt_agreements_contract ON public.debt_agreements(contract_id);
CREATE INDEX IF NOT EXISTS idx_debt_agreements_tenant ON public.debt_agreements(tenant_id);

-- 3) Vínculo parcelas <-> acordo
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS debt_agreement_id uuid REFERENCES public.debt_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_installments_debt_agreement ON public.installments(debt_agreement_id);

ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS evidence_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS provider_name text;

-- Storage RLS for maintenance-evidence bucket
CREATE POLICY "auth read maintenance-evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-evidence');

CREATE POLICY "auth upload maintenance-evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-evidence');

CREATE POLICY "auth delete own maintenance-evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'maintenance-evidence' AND owner = auth.uid());
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.platform_settings (key, value, description) 
VALUES ('nexo_boleto_fee', '24.99', 'Taxa NEXO por boleto/Pix gerado');
-- 1) Maintenance evidence: tighten storage read policy
DROP POLICY IF EXISTS "auth read maintenance-evidence" ON storage.objects;
CREATE POLICY "auth read maintenance-evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'maintenance-evidence'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.maintenances m
        WHERE storage.objects.name = ANY (m.evidence_urls)
          AND (
            m.user_id = auth.uid()
            OR m.tenant_id = public.current_tenant_id()
            OR m.user_id = public.current_manager_id()
          )
      )
    )
  );

-- 2) Maintenance evidence: tighten upload policy to own folder
DROP POLICY IF EXISTS "auth upload maintenance-evidence" ON storage.objects;
CREATE POLICY "auth upload maintenance-evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Platform settings: restrict reads to managers only
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Managers can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- 4) Realtime: restrict maintenance_messages channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance chat channel access" ON realtime.messages;
CREATE POLICY "maintenance chat channel access"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'mm:%' THEN EXISTS (
        SELECT 1 FROM public.maintenances m
        WHERE m.id::text = substring(realtime.topic() from 4)
          AND (
            m.user_id = auth.uid()
            OR m.tenant_id = public.current_tenant_id()
            OR m.user_id = public.current_manager_id()
          )
      )
      ELSE true
    END
  );
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requested_role text;
  final_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'owner');
  IF requested_role = 'manager' OR requested_role = 'imobiliaria' THEN
    final_role := 'manager'::app_role;
  ELSE
    final_role := 'owner'::app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, final_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;
-- Add UPDATE policy on maintenance-evidence bucket (owner-only)
DROP POLICY IF EXISTS "auth update maintenance-evidence" ON storage.objects;
CREATE POLICY "auth update maintenance-evidence"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-evidence' AND owner = auth.uid())
WITH CHECK (bucket_id = 'maintenance-evidence' AND owner = auth.uid());

-- Fix realtime messages policy: deny non-maintenance topics
DROP POLICY IF EXISTS "maintenance chat channel access" ON realtime.messages;
CREATE POLICY "maintenance chat channel access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN (realtime.topic() LIKE 'mm:%') THEN EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id::text = substring(realtime.topic() from 4)
        AND (
          m.user_id = auth.uid()
          OR m.tenant_id = public.current_tenant_id()
          OR m.user_id = public.current_manager_id()
        )
    )
    ELSE false
  END
);
CREATE POLICY "Managers can insert platform settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers can update platform settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payout_wallet_id text;-- Transaction type enum
DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('Aluguel', 'Venda');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tipo_transacao public.transaction_type NOT NULL DEFAULT 'Aluguel',
  ADD COLUMN IF NOT EXISTS valor_aluguel numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_venda numeric(12,2),
  ADD COLUMN IF NOT EXISTS publish_imovelweb boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_zap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bedrooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bathrooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS description text;

-- Integration token on profiles (per-agency token)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS integration_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_integration_token_idx ON public.profiles(integration_token);

-- Backfill any nulls (defensive, though NOT NULL DEFAULT covers new rows)
UPDATE public.profiles SET integration_token = gen_random_uuid() WHERE integration_token IS NULL;

-- Photos table
CREATE TABLE IF NOT EXISTS public.property_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_photos_property_idx ON public.property_photos(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_photos TO authenticated;
GRANT ALL ON public.property_photos TO service_role;

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages photos" ON public.property_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS integration_imovelweb_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integration_zap_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS kyc_reference_id text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_digit text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS auto_transfer_enabled boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT profiles_kyc_status_check CHECK (kyc_status IN ('PENDENTE','EM_ANALISE','APROVADO','REJEITADO'));
ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'em_aberto';

CREATE OR REPLACE FUNCTION public.generate_installments_for_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  months_count INT;
  i INT;
  due DATE;
  base_date DATE;
  max_day INT;
  use_day INT;
  initial_status installment_status;
BEGIN
  months_count := (EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12
                  + EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date)))::INT;
  IF months_count < 1 THEN months_count := 1; END IF;

  FOR i IN 0..(months_count - 1) LOOP
    base_date := (date_trunc('month', NEW.start_date) + (i || ' month')::interval)::date;
    max_day := EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '1 month - 1 day'))::int;
    use_day := LEAST(NEW.due_day, max_day);
    due := make_date(EXTRACT(YEAR FROM base_date)::int, EXTRACT(MONTH FROM base_date)::int, use_day);

    -- Parcelas futuras nascem AGENDADAS (just-in-time). Vencimentos
    -- já passados ou dentro do horizonte imediato seguem como pendente
    -- para não bloquear contratos retroativos.
    IF due > (CURRENT_DATE + INTERVAL '15 days') THEN
      initial_status := 'agendado'::installment_status;
    ELSE
      initial_status := 'pendente'::installment_status;
    END IF;

    INSERT INTO public.installments (user_id, contract_id, due_date, amount, status)
    VALUES (NEW.user_id, NEW.id, due, NEW.rent_amount, initial_status);
  END LOOP;

  UPDATE public.properties SET status = 'alugado' WHERE id = NEW.property_id AND user_id = NEW.user_id;

  RETURN NEW;
END; $function$;CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS extensions;

-- pg_net não suporta SET SCHEMA; remover e recriar no schema correto.
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-invoices-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Reagenda o cron usando a service role key (server-only).
SELECT cron.schedule(
  'process-scheduled-invoices-daily',
  '0 8 * * *',
  $cmd$
  SELECT extensions.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/process-scheduled-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- Reagenda o cron usando o CRON_SECRET armazenado no Vault.
-- O valor real será inserido no vault por uma função server-side admin
-- (installCronSecret) que lê process.env.CRON_SECRET.
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-invoices-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-scheduled-invoices-daily',
  '0 8 * * *',
  $cmd$
  SELECT extensions.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/process-scheduled-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

CREATE OR REPLACE FUNCTION public.sync_cron_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  existing_id uuid;
BEGIN
  -- Apenas o service_role (backend confiável) pode executar esta função.
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'CRON_SECRET', 'Cron job shared secret');
  ELSE
    PERFORM vault.update_secret(existing_id, _secret, 'CRON_SECRET', 'Cron job shared secret');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cron_secret(text) TO service_role;
CREATE POLICY "property-images public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'property-images');

-- Authenticated owner can INSERT into folder = property.id they own
CREATE POLICY "property-images owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "property-images owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "property-images owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.user_id = auth.uid()
    )
  );
-- 1) Maintenances: prevent tenants from forging user_id
DROP POLICY IF EXISTS "Tenant creates own maintenances" ON public.maintenances;
CREATE POLICY "Tenant creates own maintenances" ON public.maintenances
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = (SELECT t.user_id FROM public.tenants t WHERE t.id = public.current_tenant_id())
  );

-- 2) Storage: restrict property-images SELECT to authenticated users
DROP POLICY IF EXISTS "property-images public read" ON storage.objects;
CREATE POLICY "property-images authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'property-images');

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity, entity_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only managers/owners can read audit logs; users cannot write directly (only via triggers or service_role)
CREATE POLICY "managers and owners read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

-- No client INSERT policy: writes happen via SECURITY DEFINER trigger or service_role from server functions.

-- ===== Trigger for maintenances changes =====
CREATE OR REPLACE FUNCTION public.log_maintenance_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_id text;
  v_ip text;
  v_ua text;
  v_email text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'maintenance.create';
    v_id := NEW.id::text;
    v_meta := jsonb_build_object('title', NEW.title, 'status', NEW.status, 'property_id', NEW.property_id);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'maintenance.update';
    v_id := NEW.id::text;
    v_meta := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
          AND key NOT IN ('updated_at')
      )
    );
  ELSE
    v_action := 'maintenance.delete';
    v_id := OLD.id::text;
    v_meta := jsonb_build_object('title', OLD.title, 'status', OLD.status);
  END IF;

  -- Extract IP / UA from PostgREST request headers (set by Supabase Data API)
  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
    v_email := current_setting('request.jwt.claims', true)::json->>'email';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL; v_email := NULL;
  END;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, ip_address, user_agent, metadata)
  VALUES (auth.uid(), v_email, v_action, 'maintenances', v_id, v_ip, v_ua, COALESCE(v_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER maintenances_audit_log
AFTER INSERT OR UPDATE OR DELETE ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.log_maintenance_changes();

REVOKE EXECUTE ON FUNCTION public.log_maintenance_changes() FROM PUBLIC, anon, authenticated;

-- Tighten audit_logs privileges (default PUBLIC grants existed)
REVOKE ALL ON public.audit_logs FROM PUBLIC;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.verify_security_invariants()
RETURNS TABLE(check_name text, status text, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_table text;
  v_rls boolean;
  v_count int;
  v_qual text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT relrowsecurity INTO v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=v_table;
    IF v_rls IS NULL THEN
      RETURN QUERY SELECT format('rls.%s', v_table), 'SKIP', 'table not found';
    ELSIF NOT v_rls THEN
      RAISE EXCEPTION 'RLS NOT ENABLED on public.%', v_table;
    ELSE
      RETURN QUERY SELECT format('rls.%s', v_table), 'OK', 'rls enabled';
    END IF;
  END LOOP;

  -- audit_logs: SELECT policy requires manager OR owner
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs' AND cmd='SELECT'
    AND qual LIKE '%has_role%manager%' AND qual LIKE '%has_role%owner%';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'audit_logs SELECT policy must require manager or owner role';
  END IF;
  RETURN QUERY SELECT 'audit_logs.select_policy', 'OK', 'manager/owner only';

  -- audit_logs: no anon policies
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs' AND 'anon' = ANY(roles);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'audit_logs must NOT have any anon policies';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_anon_policy', 'OK', 'no anon policies';

  -- audit_logs: no INSERT/UPDATE/DELETE/ALL policies (writes via service_role only)
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='audit_logs'
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'audit_logs must not expose write policies to authenticated';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_write_policies', 'OK', 'writes via service_role only';

  -- audit_logs: anon must NOT have INSERT/UPDATE/DELETE table privileges
  IF has_table_privilege('anon','public.audit_logs','INSERT')
     OR has_table_privilege('anon','public.audit_logs','UPDATE')
     OR has_table_privilege('anon','public.audit_logs','DELETE') THEN
    RAISE EXCEPTION 'audit_logs must not grant write privileges to anon';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_anon_write_grant', 'OK', 'anon has no write grants';

  -- authenticated must NOT have INSERT/UPDATE/DELETE on audit_logs
  IF has_table_privilege('authenticated','public.audit_logs','INSERT')
     OR has_table_privilege('authenticated','public.audit_logs','UPDATE')
     OR has_table_privilege('authenticated','public.audit_logs','DELETE') THEN
    RAISE EXCEPTION 'audit_logs must not grant write privileges to authenticated';
  END IF;
  RETURN QUERY SELECT 'audit_logs.no_authenticated_write_grant', 'OK', 'authenticated has no write grants';

  -- Cross-tenant isolation
  FOR v_table, v_qual IN
    SELECT tablename, qual FROM pg_policies
    WHERE schemaname='public'
      AND tablename = ANY(ARRAY['maintenances','installments','contracts','properties','tenants','property_photos'])
      AND cmd IN ('SELECT','UPDATE','DELETE','ALL')
  LOOP
    IF v_qual IS NULL THEN
      RAISE EXCEPTION 'Open policy on %: NULL USING clause', v_table;
    END IF;
    IF v_qual NOT LIKE '%auth.uid()%'
       AND v_qual NOT LIKE '%current_tenant_id()%'
       AND v_qual NOT LIKE '%current_manager_id()%'
       AND v_qual NOT LIKE '%has_role%' THEN
      RAISE EXCEPTION 'Policy on % is not scoped by user/tenant/manager: %', v_table, v_qual;
    END IF;
  END LOOP;
  RETURN QUERY SELECT 'cross_tenant.scoping', 'OK', 'all policies scoped';

  -- user_roles: no authenticated write policies (no self-promotion)
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='user_roles'
    AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND 'authenticated' = ANY(roles);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'user_roles must not allow authenticated writes (privilege escalation risk)';
  END IF;
  RETURN QUERY SELECT 'user_roles.no_self_write', 'OK', 'no authenticated write policies';

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_security_invariants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_invariants() TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.verify_security_invariants() LOOP
    RAISE NOTICE '[security] % => % (%)', r.check_name, r.status, r.details;
  END LOOP;
END $$;
ALTER TABLE public.maintenance_messages ADD COLUMN IF NOT EXISTS attachment_urls text[] NOT NULL DEFAULT '{}';ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_pdf_path text;
-- Owner/manager: full access to their contracts' files (path layout: <contract_id>/<filename>)
CREATE POLICY "contracts_pdf_owner_all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND c.user_id = auth.uid()
  )
);

-- Tenant: read-only access to PDF of their own contract
CREATE POLICY "contracts_pdf_tenant_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1
    FROM public.contracts c
    JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.id::text = split_part(storage.objects.name, '/', 1)
      AND t.user_id_link = auth.uid()
  )
);

-- Tabela de log de notificações por parcela (régua de cobrança WhatsApp)
CREATE TABLE public.installment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  stage text NOT NULL,
  status text NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installment_notifications_status_chk CHECK (status IN ('sent','failed','skipped')),
  CONSTRAINT installment_notifications_stage_chk CHECK (stage IN ('welcome','pre-10','pre-5','pre-2','pre-1','post-1','post-2','post-3','post-5','post-7')),
  CONSTRAINT installment_notifications_unique UNIQUE (installment_id, stage, channel)
);

CREATE INDEX idx_inst_notif_installment ON public.installment_notifications(installment_id);
CREATE INDEX idx_inst_notif_contract ON public.installment_notifications(contract_id);

GRANT SELECT ON public.installment_notifications TO authenticated;
GRANT ALL ON public.installment_notifications TO service_role;

ALTER TABLE public.installment_notifications ENABLE ROW LEVEL SECURITY;

-- Owner do contrato pode ver
CREATE POLICY "Owner reads own installment notifications"
ON public.installment_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Manager do owner pode ver
CREATE POLICY "Manager reads installment notifications"
ON public.installment_notifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.manager_members mm
    WHERE mm.member_user_id = auth.uid()
      AND mm.status = 'ativo'
      AND mm.manager_user_id = public.installment_notifications.user_id
  )
  OR public.current_manager_id() = user_id
);

-- Inquilino pode ver as suas próprias
CREATE POLICY "Tenant reads own installment notifications"
ON public.installment_notifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.installments i
    JOIN public.contracts c ON c.id = i.contract_id
    WHERE i.id = public.installment_notifications.installment_id
      AND c.tenant_id = public.current_tenant_id()
  )
);

-- =========================================================
-- 1) STORAGE: property-images SELECT mais restrita
-- =========================================================
DROP POLICY IF EXISTS "property-images authenticated read" ON storage.objects;

CREATE POLICY "property-images scoped read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE (p.id)::text = (storage.foldername(objects.name))[1]
      AND (
        p.user_id = auth.uid()
        OR p.user_id = public.current_manager_id()
        OR EXISTS (
          SELECT 1 FROM public.contracts c
          WHERE c.property_id = p.id
            AND c.tenant_id = public.current_tenant_id()
        )
      )
  )
);

-- =========================================================
-- 2) STORAGE: INSERTs com WITH CHECK adequado
-- =========================================================
DROP POLICY IF EXISTS "property-images owner insert" ON storage.objects;
CREATE POLICY "property-images owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE (p.id)::text = (storage.foldername(objects.name))[1]
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "auth upload maintenance-evidence" ON storage.objects;
CREATE POLICY "auth upload maintenance-evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-evidence'
  AND owner = auth.uid()
);

-- =========================================================
-- 3) manager_members.invite_token: esconder de leitura
-- =========================================================
REVOKE SELECT (invite_token) ON public.manager_members FROM authenticated, anon;

-- Função para aceitar convite sem expor o token
CREATE OR REPLACE FUNCTION public.accept_manager_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.manager_members
     SET member_user_id = auth.uid(),
         status = 'ativo',
         accepted_at = now(),
         invite_token = NULL
   WHERE invite_token = _token
     AND status IN ('pendente', 'convidado')
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_used_token';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_manager_invite(text) TO authenticated;

-- =========================================================
-- 4) SECURITY DEFINER: tirar de PUBLIC/anon
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_manager_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_manager_id() TO authenticated;

-- =========================================================
-- 5) ÍNDICES (perf) — FK heavy
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_installments_contract_id ON public.installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_installments_user_id     ON public.installments(user_id);

CREATE INDEX IF NOT EXISTS idx_contracts_property_id ON public.contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id   ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id     ON public.contracts(user_id);

CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_property_id ON public.maintenances(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_user_id     ON public.maintenances(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_tenant_id   ON public.maintenances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_manager_members_member  ON public.manager_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_members_manager ON public.manager_members(manager_user_id);

DROP POLICY IF EXISTS "managers and owners read audit logs" ON public.audit_logs;

CREATE POLICY "users read their own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND user_id = public.current_manager_id()
  )
);

-- 1) Add phone to profiles (nullable, owners/managers fill in)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2) Tracking table for maintenance-response reminders
CREATE TABLE IF NOT EXISTS public.maintenance_response_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES public.maintenances(id) ON DELETE CASCADE,
  last_tenant_message_id uuid NOT NULL REFERENCES public.maintenance_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_id, last_tenant_message_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_mrn_maintenance ON public.maintenance_response_notifications(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_mrn_user ON public.maintenance_response_notifications(user_id);

GRANT SELECT ON public.maintenance_response_notifications TO authenticated;
GRANT ALL ON public.maintenance_response_notifications TO service_role;

ALTER TABLE public.maintenance_response_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners and managers read their maintenance response notifs"
ON public.maintenance_response_notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.current_manager_id()
);

-- 1. properties: dono direto do imóvel
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS responsible_member_id uuid REFERENCES public.manager_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_responsible_member ON public.properties(responsible_member_id);

-- 2. manager_members: métricas p/ roleta
ALTER TABLE public.manager_members
  ADD COLUMN IF NOT EXISTS total_sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hire_date timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. crm_leads: rastreio do roteamento + origem
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS portal_origin text,
  ADD COLUMN IF NOT EXISTS routed_member_id uuid REFERENCES public.manager_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routing_criteria_used text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_crm_leads_routed_member ON public.crm_leads(routed_member_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_manager ON public.crm_leads(manager_user_id);

-- Membro vê os leads que recebeu (sem perder a policy do manager)
DROP POLICY IF EXISTS "Member views routed leads" ON public.crm_leads;
CREATE POLICY "Member views routed leads" ON public.crm_leads
  FOR SELECT TO authenticated
  USING (
    routed_member_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.manager_members mm
      WHERE mm.id = crm_leads.routed_member_id
        AND mm.member_user_id = auth.uid()
    )
  );

-- 4. agency_settings: configuração da roleta + token de webhook
CREATE TABLE IF NOT EXISTS public.agency_settings (
  manager_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_routing_strategy text NOT NULL DEFAULT 'DIRECT_OR_ROUND_ROBIN_ALPHABETICAL'
    CHECK (lead_routing_strategy IN (
      'DIRECT_OR_ROUND_ROBIN_ALPHABETICAL',
      'DIRECT_OR_ROUND_ROBIN_SALES',
      'DIRECT_OR_ROUND_ROBIN_TENURE'
    )),
  last_round_robin_member_id uuid REFERENCES public.manager_members(id) ON DELETE SET NULL,
  webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_settings_token ON public.agency_settings(webhook_token);

GRANT SELECT, INSERT, UPDATE ON public.agency_settings TO authenticated;
GRANT ALL ON public.agency_settings TO service_role;

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manager manages own agency settings" ON public.agency_settings;
CREATE POLICY "Manager manages own agency settings" ON public.agency_settings
  FOR ALL TO authenticated
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at_agency_settings ON public.agency_settings;
CREATE TRIGGER set_updated_at_agency_settings BEFORE UPDATE ON public.agency_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Realtime para crm_leads
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.manager_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS org_slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_org_slug(_manager_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base text;
  candidate text;
  attempt int := 0;
BEGIN
  SELECT lower(regexp_replace(coalesce(p.full_name, 'imobiliaria'), '[^a-zA-Z0-9]+', '-', 'g'))
    INTO base
  FROM public.profiles p
  WHERE p.id = _manager_user_id;

  base := trim(both '-' from coalesce(base, 'imobiliaria'));
  IF base IS NULL OR base = '' THEN base := 'imobiliaria'; END IF;
  IF length(base) > 40 THEN base := substring(base from 1 for 40); END IF;

  LOOP
    candidate := base || '-' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
    PERFORM 1 FROM public.agency_settings WHERE org_slug = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RETURN base || '-' || substring(md5(random()::text || clock_timestamp()::text || _manager_user_id::text) from 1 for 10);
    END IF;
  END LOOP;
END;
$$;

INSERT INTO public.agency_settings (manager_user_id)
SELECT p.id FROM public.profiles p
LEFT JOIN public.agency_settings a ON a.manager_user_id = p.id
WHERE a.manager_user_id IS NULL;

UPDATE public.agency_settings
   SET org_slug = public.generate_org_slug(manager_user_id)
 WHERE org_slug IS NULL;

CREATE OR REPLACE FUNCTION public.agency_settings_set_org_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_slug IS NULL OR NEW.org_slug = '' THEN
    NEW.org_slug := public.generate_org_slug(NEW.manager_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_settings_org_slug_trg ON public.agency_settings;
CREATE TRIGGER agency_settings_org_slug_trg
  BEFORE INSERT ON public.agency_settings
  FOR EACH ROW EXECUTE FUNCTION public.agency_settings_set_org_slug();

REVOKE EXECUTE ON FUNCTION public.generate_org_slug(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agency_settings_set_org_slug() FROM PUBLIC, anon, authenticated;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord';
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
       AND coalesce(p.notes, '') LIKE '%' || v_norm_doc || '%';
  END IF;

  RETURN v_invite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_landlord_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS document_type text;

-- Controle do repasse diário ao proprietário
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS landlord_payout_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS landlord_payout_amount numeric,
  ADD COLUMN IF NOT EXISTS landlord_payout_date timestamptz,
  ADD COLUMN IF NOT EXISTS landlord_payout_error text;

CREATE INDEX IF NOT EXISTS idx_installments_landlord_payout_pending
  ON public.installments(status, landlord_payout_status)
  WHERE status = 'pago' AND landlord_payout_status = 'pendente';

-- 1) audit_logs SELECT: restringe ao próprio dono (fecha bypass via current_manager_id)
DROP POLICY IF EXISTS "users read their own audit logs" ON public.audit_logs;

CREATE POLICY "users read their own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'tenant'::app_role)
    OR has_role(auth.uid(), 'landlord'::app_role)
  )
);

-- 2) landlord_invites: oculta a coluna invite_token de roles não-privilegiadas.
-- O fluxo de aceitação continua via accept_landlord_invite (SECURITY DEFINER),
-- usando o token recebido no link de convite — nunca lido do banco pelo cliente.
REVOKE SELECT (invite_token) ON public.landlord_invites FROM authenticated;
REVOKE SELECT (invite_token) ON public.landlord_invites FROM anon;
-- Fix infinite recursion: properties policy "Tenant views rented property"
-- references contracts; contracts/landlord policy references properties;
-- when Postgres evaluates them they keep calling each other.
-- Wrap the tenant check in a SECURITY DEFINER function so contracts isn't
-- queried through RLS during properties policy evaluation.

CREATE OR REPLACE FUNCTION public.is_current_tenant_property(_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contracts c
    WHERE c.property_id = _property_id
      AND c.tenant_id = public.current_tenant_id()
      AND c.active
  )
$$;

DROP POLICY IF EXISTS "Tenant views rented property" ON public.properties;
CREATE POLICY "Tenant views rented property"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (public.is_current_tenant_property(id));
-- Hardening RLS em tabelas com dados financeiros / PII do proprietário.
--    REVOKE explícito de anon, e NOT NULL em user_id.
DROP POLICY IF EXISTS "Landlord manage own withdrawals" ON public.landlord_withdrawals;
CREATE POLICY "Landlord manage own withdrawals"
  ON public.landlord_withdrawals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own efi_credentials" ON public.efi_credentials;
CREATE POLICY "Users manage own efi_credentials"
  ON public.efi_credentials FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) profiles: garantir que anon não enxergue PII (nome, email, telefone).
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
REVOKE SELECT (invite_token) ON public.landlord_invites FROM authenticated;
REVOKE SELECT (invite_token) ON public.landlord_invites FROM anon;-- Harden user-scoped financial and landlord data isolation.
-- No new tables are created in this migration.

REVOKE ALL ON TABLE public.landlord_withdrawals FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.properties FROM anon;
REVOKE ALL ON TABLE public.contracts FROM anon;
REVOKE ALL ON TABLE public.installments FROM anon;
REVOKE ALL ON TABLE public.maintenances FROM anon;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_withdrawals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.installments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_withdrawals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Landlord manage own withdrawals scoped" ON public.landlord_withdrawals;
CREATE POLICY "Landlord manage own withdrawals scoped"
  ON public.landlord_withdrawals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenances TO authenticated;
GRANT ALL ON public.maintenances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlord_withdrawals TO authenticated;
GRANT ALL ON public.landlord_withdrawals TO service_role;REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_landlord_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) TO authenticated;-- Defense-in-depth hardening after cross-account data exposure report.
-- Goal: no browser/user role can read or mutate another user's sensitive rows,
-- even if a query is written too broadly or a legacy grant exists.

-- 1) Remove legacy/public table grants from non-application roles.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- sandbox_exec has BYPASSRLS in this project; it must never keep direct access
-- to tenant/landlord/financial application tables.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM sandbox_exec;

-- 2) Force RLS on every user/business table. Service-role jobs still work
-- through BYPASSRLS, but table-owner accidental bypass is prevented.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agency_settings',
    'audit_logs',
    'contracts',
    'crm_lead_notes',
    'crm_leads',
    'debt_agreements',
    'inspections',
    'installment_notifications',
    'installments',
    'landlord_invites',
    'landlord_withdrawals',
    'maintenance_messages',
    'maintenance_response_notifications',
    'maintenances',
    'manager_members',
    'profiles',
    'properties',
    'property_photos',
    'tenants',
    'user_roles'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 3) Recreate the most sensitive owner-scoped policies with explicit auth.uid()
-- predicates. These policies intentionally do not include manager/landlord joins.

DROP POLICY IF EXISTS "Manager manages own team re-scoped" ON public.manager_members;
CREATE POLICY "Manager manages own team re-scoped"
  ON public.manager_members FOR ALL TO authenticated
  USING (manager_user_id = auth.uid()) WITH CHECK (manager_user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4) Keep only the minimum function surface callable by logged-in users.
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_manager_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_current_tenant_property(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_landlord_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_manager_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_landlord_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_manager_invite(text) TO authenticated;

-- 5) Preserve normal app access for authenticated users; RLS decides the rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
DELETE FROM auth.users WHERE id = '220dcb18-25db-4410-99c4-29aa7881e75b';
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
CREATE UNIQUE INDEX IF NOT EXISTS pix_splits_installment_unique ON public.pix_splits(installment_id);REVOKE SELECT (invite_token) ON public.landlord_invites FROM authenticated;
REVOKE SELECT (invite_token) ON public.landlord_invites FROM anon;
-- 1. Add deleted_at columns
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tenants_not_deleted_idx ON public.tenants (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contracts_not_deleted_idx ON public.contracts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contracts_property_not_deleted_idx ON public.contracts (property_id) WHERE deleted_at IS NULL;

-- 2. Replace CASCADE with RESTRICT on contracts.tenant_id to protect history
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_tenant_id_fkey;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS income_value numeric;

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
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS efi_account_number text;

ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS agency_efi_account_number text,
  ADD COLUMN IF NOT EXISTS agency_document text;CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'efi-cycle-hourly') THEN
    PERFORM cron.unschedule('efi-cycle-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'efi-cycle-hourly',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dashboard.usenexoapp.com/api/public/hooks/efi-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
  $$
);DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'efi-cycle-hourly') THEN
    PERFORM cron.unschedule('efi-cycle-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'efi-cycle-hourly',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dashboard.usenexoapp.com/api/public/hooks/efi-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
  $$
);DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE command ILIKE '%efi%' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;
-- =========================================================
-- =========================================================

-- Cleanup legacy Efí artifacts (safe if absent)
DROP TABLE IF EXISTS public.efi_payouts CASCADE;
ALTER TABLE IF EXISTS public.agency_settings DROP COLUMN IF EXISTS agency_efi_account_number;
ALTER TABLE IF EXISTS public.agency_settings DROP COLUMN IF EXISTS efi_account_number;

-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_transfer_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_recipient_type AS ENUM ('nexo', 'agency', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- =========================================================
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  manager_user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE,
  txid TEXT,
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




  FOR SELECT TO authenticated
  USING (manager_user_id = public.current_manager_id());

  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.contracts c ON c.id = i.contract_id
        AND c.tenant_id = public.current_tenant_id()
    )
  );

  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.contracts c ON c.id = i.contract_id
      JOIN public.properties p ON p.id = c.property_id
        AND p.landlord_id = public.current_landlord_id()
    )
  );

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
-- =========================================================
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  subscription TEXT NOT NULL,
  log_type TEXT,
  raw JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- no authenticated grants — server-only

-- deny-all by omission for authenticated

-- =========================================================
-- INSTALLMENTS FK
-- =========================================================
ALTER TABLE public.installments

ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenances_contract_id ON public.maintenances(contract_id);

-- Backfill: prefer contract matching property + tenant; fall back to active contract for property
UPDATE public.maintenances m
SET contract_id = c.id
FROM public.contracts c
WHERE m.contract_id IS NULL
  AND c.property_id = m.property_id
  AND c.deleted_at IS NULL
  AND (m.tenant_id IS NULL OR c.tenant_id = m.tenant_id)
  AND c.id = (
    SELECT c2.id FROM public.contracts c2
    WHERE c2.property_id = m.property_id
      AND c2.deleted_at IS NULL
      AND (m.tenant_id IS NULL OR c2.tenant_id = m.tenant_id)
    ORDER BY (c2.active) DESC,
             (c2.start_date <= m.created_at::date AND c2.end_date >= m.created_at::date) DESC,
             c2.start_date DESC
    LIMIT 1
  );

-- Trigger: auto-fill contract_id on insert when omitted
CREATE OR REPLACE FUNCTION public.set_maintenance_contract_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_id IS NULL THEN
    SELECT c.id INTO NEW.contract_id
    FROM public.contracts c
    WHERE c.property_id = NEW.property_id
      AND c.deleted_at IS NULL
      AND (NEW.tenant_id IS NULL OR c.tenant_id = NEW.tenant_id)
    ORDER BY (c.active) DESC, c.start_date DESC
    LIMIT 1;
  END IF;

  -- Keep tenant_id consistent when a contract is chosen
  IF NEW.contract_id IS NOT NULL AND NEW.tenant_id IS NULL THEN
    SELECT c.tenant_id INTO NEW.tenant_id
    FROM public.contracts c WHERE c.id = NEW.contract_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_maintenance_contract_id ON public.maintenances;
CREATE TRIGGER trg_set_maintenance_contract_id
BEFORE INSERT ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.set_maintenance_contract_id();

-- Re-agenda os 4 jobs financeiros com Authorization: Bearer <CRON_SECRET>
-- lido da vault. Se o segredo não estiver na vault, as rotas responderão 401
-- (fail-closed).

SELECT cron.unschedule('generate-upcoming-boletos-daily');

SELECT cron.schedule(
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nexos-inquilinos.lovable.app/api/public/hooks/process-payout-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'generate-upcoming-boletos-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--231b8419-e2f6-4a97-8769-d585255d26c4.lovable.app/api/public/hooks/generate-upcoming-boletos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  '15 * * * *',
  $$
  SELECT net.http_post(
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Remove entrada com secret NULL criada por engano
DELETE FROM vault.secrets WHERE name = 'CRON_SECRET' AND secret IS NULL;

-- Corrige a checagem para funcionar com chaves sb_secret_* atuais:
-- aceitamos quando auth.role()='service_role' (PostgREST) OU sessão postgres.
CREATE OR REPLACE FUNCTION public.sync_cron_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  existing_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _secret IS NULL OR length(_secret) = 0 THEN
    RAISE EXCEPTION 'empty secret';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'CRON_SECRET', 'Cron job shared secret');
  ELSE
    PERFORM vault.update_secret(existing_id, _secret, 'CRON_SECRET', 'Cron job shared secret');
  END IF;
END;
$function$;

-- Restringe execute para apenas service_role (chamado a partir do server)
REVOKE ALL ON FUNCTION public.sync_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cron_secret(text) TO service_role;

-- Harden EXECUTE grants on SECURITY DEFINER functions.
-- Trigger functions and internal admin helpers must NOT be callable
-- via PostgREST by anon/authenticated. Functions required by RLS or
-- by explicit user actions (invites) keep their execute grants.

-- Revoke default PUBLIC EXECUTE (anon+authenticated inherit from PUBLIC on default Postgres,
-- but Supabase grants EXECUTE to anon/authenticated on functions in `public`).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_maintenance_changes()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_maintenance_contract_id()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agency_settings_set_org_slug()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments_for_contract()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_org_slug(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_property_code()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_security_invariants()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_cron_secret(text)                  FROM PUBLIC, anon, authenticated;

-- Keep essential RLS helpers and invite acceptance callable by authenticated users.
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)                TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_tenant_id()                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_manager_id()                    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_landlord_id()                   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_current_tenant_property(uuid)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_landlord_invite(text)            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_manager_invite(text)             TO authenticated;

-- Anon must never call any SECURITY DEFINER helper.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id()                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_manager_id()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_landlord_id()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_tenant_property(uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_landlord_invite(text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text)             FROM anon;

-- 1) Novo campo: responsável pela execução (reusa enum existente maintenance_responsible)
ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS execution_responsible public.maintenance_responsible
  NOT NULL DEFAULT 'inquilino'::public.maintenance_responsible;

COMMENT ON COLUMN public.maintenances.execution_responsible IS
  'Quem executa a manutenção após análise do proprietário (proprietario|inquilino). Default inquilino preserva o fluxo atual de orçamento.';

-- 2) Tabela de eventos (timeline / histórico)
CREATE TABLE IF NOT EXISTS public.maintenance_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES public.maintenances(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   text,
  actor_role   text,           -- 'owner' | 'tenant' | 'landlord' | 'manager' | 'system'
  action       text NOT NULL,  -- ex: 'created', 'responsible_set', 'budget_submitted', ...
  description  text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_maintenance
  ON public.maintenance_events(maintenance_id, created_at DESC);

GRANT SELECT, INSERT ON public.maintenance_events TO authenticated;
GRANT ALL ON public.maintenance_events TO service_role;

ALTER TABLE public.maintenance_events ENABLE ROW LEVEL SECURITY;

-- SELECT: dono da manutenção, inquilino vinculado, ou landlord do imóvel
CREATE POLICY "maint_events_select"
  ON public.maintenance_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id = maintenance_events.maintenance_id
        AND (
          m.user_id = auth.uid()
          OR m.tenant_id = public.current_tenant_id()
          OR (
            public.has_role(auth.uid(), 'landlord'::app_role)
            AND EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = m.property_id AND p.landlord_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT: mesmas partes autorizadas; user_id deve casar com auth.uid()
CREATE POLICY "maint_events_insert"
  ON public.maintenance_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id = maintenance_events.maintenance_id
        AND (
          m.user_id = auth.uid()
          OR m.tenant_id = public.current_tenant_id()
          OR (
            public.has_role(auth.uid(), 'landlord'::app_role)
            AND EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = m.property_id AND p.landlord_id = auth.uid()
            )
          )
        )
    )
  );

-- Sem policies de UPDATE/DELETE: histórico imutável para authenticated; service_role mantém acesso total.

ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS workflow_stage           text,
  ADD COLUMN IF NOT EXISTS provider_phone           text,
  ADD COLUMN IF NOT EXISTS final_notes              text,
  ADD COLUMN IF NOT EXISTS invoice_urls             text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS completion_photo_urls    text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS payment_receipt_urls     text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS payment_method           text,
  ADD COLUMN IF NOT EXISTS payment_approved_amount  numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_paid_amount      numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_date             date,
  ADD COLUMN IF NOT EXISTS payment_notes            text,
  ADD COLUMN IF NOT EXISTS payment_applied_installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.maintenances.workflow_stage IS
  'Etapa detalhada do fluxo. Ex.: solicitado, em_analise, aguardando_agendamento, aguardando_orcamento, orcamento_enviado, orcamento_aprovado, servico_autorizado, servico_concluido, aguardando_pagamento, concluida.';

COMMENT ON COLUMN public.maintenances.payment_method IS
  'Método de pagamento ao inquilino: pix | desconto_aluguel | outro.';

-- Add new inspection kinds (preventiva, extraordinaria)
ALTER TYPE public.inspection_kind ADD VALUE IF NOT EXISTS 'preventiva';
ALTER TYPE public.inspection_kind ADD VALUE IF NOT EXISTS 'extraordinaria';

-- Landlord access to inspections through property ownership
CREATE POLICY "Landlord views inspections of own properties"
ON public.inspections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlord inserts inspections for own properties"
ON public.inspections
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlord updates own inspections"
ON public.inspections
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
)
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Landlord deletes own draft inspections"
ON public.inspections
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND status = 'rascunho'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id
      AND p.landlord_id = auth.uid()
  )
);

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'outros',
  custom_category TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  file_ext TEXT,
  document_date DATE,
  expires_at DATE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  maintenance_id UUID REFERENCES public.maintenances(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents select" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own documents insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own documents update" ON public.documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own documents delete" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_documents_user ON public.documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_property ON public.documents(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_contract ON public.documents(contract_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_expires ON public.documents(expires_at) WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Document events (history)
CREATE TABLE public.document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_events TO authenticated;
GRANT ALL ON public.document_events TO service_role;

ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own document events" ON public.document_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users insert own document events" ON public.document_events
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND d.user_id = auth.uid())
  );

CREATE INDEX idx_document_events_document ON public.document_events(document_id, created_at DESC);

CREATE POLICY "Users read own documents files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own documents files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own documents files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own documents files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_inspections_contract ON public.inspections(contract_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user ON public.inspections(user_id);
-- Allow tenants to read documents linked to their active contract, and to download the underlying files.

CREATE POLICY "Tenants read documents of their contract"
ON public.documents
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND contract_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = documents.contract_id
      AND c.tenant_id = public.current_tenant_id()
      AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Tenants read documents storage of their contract"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.contracts c ON c.id = d.contract_id
    WHERE d.storage_path = storage.objects.name
      AND d.deleted_at IS NULL
      AND c.tenant_id = public.current_tenant_id()
      AND c.deleted_at IS NULL
  )
);

-- =========================================================================
-- 1) Atomic claim para payment_transfers (BUG-C3)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_pending_transfers(_limit int DEFAULT 20)
RETURNS SETOF public.payment_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.payment_transfers
    WHERE status = 'PENDING'
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at NULLS FIRST
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.payment_transfers t
     SET status = 'PROCESSING'
    FROM picked
   WHERE t.id = picked.id
  RETURNING t.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_transfers(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_transfers(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_transfers(int) TO service_role;

-- =========================================================================
-- 2) Índices de performance (BUG-M8)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_payment_transfers_status_next_retry
  ON public.payment_transfers (status, next_retry_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_payment_transfers_installment
  ON public.payment_transfers (installment_id);

CREATE INDEX IF NOT EXISTS idx_installments_contract_due
  ON public.installments (contract_id, due_date);

CREATE INDEX IF NOT EXISTS idx_installments_user_status_due
  ON public.installments (user_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_contracts_property_active
  ON public.contracts (property_id, active);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_active
  ON public.contracts (tenant_id, active);

CREATE INDEX IF NOT EXISTS idx_properties_user
  ON public.properties (user_id);

CREATE INDEX IF NOT EXISTS idx_properties_landlord
  ON public.properties (landlord_id);

CREATE INDEX IF NOT EXISTS idx_tenants_user_link
  ON public.tenants (user_id_link);

CREATE INDEX IF NOT EXISTS idx_maintenances_property
  ON public.maintenances (property_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_contract
  ON public.maintenances (contract_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_manager_members_member_status
  ON public.manager_members (member_user_id, status);

CREATE INDEX IF NOT EXISTS idx_manager_members_manager_status
  ON public.manager_members (manager_user_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_leads_manager_created
  ON public.crm_leads (manager_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity, entity_id, created_at DESC);

-- =========================================================================
-- 3) Verificação diária de invariantes de segurança
-- =========================================================================
CREATE OR REPLACE FUNCTION public.run_security_invariants_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_meta jsonb := '[]'::jsonb;
BEGIN
  FOR v_row IN SELECT * FROM public.verify_security_invariants() LOOP
    v_meta := v_meta || jsonb_build_object(
      'check', v_row.check_name,
      'status', v_row.status,
      'details', v_row.details
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, metadata)
  VALUES (NULL, 'system@cron', 'security.invariants_check', 'system', NULL,
          jsonb_build_object('checks', v_meta, 'run_at', now()));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, metadata)
  VALUES (NULL, 'system@cron', 'security.invariants_check_failed', 'system', NULL,
          jsonb_build_object('error', SQLERRM, 'run_at', now()));
END;
$$;

REVOKE ALL ON FUNCTION public.run_security_invariants_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_invariants_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_invariants_check() TO service_role;

-- Agendar diariamente 03:15 (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('security-invariants-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-invariants-daily');

    PERFORM cron.schedule(
      'security-invariants-daily',
      '15 3 * * *',
      $CRON$ SELECT public.run_security_invariants_check(); $CRON$
    );
  END IF;
END $$;
DROP POLICY IF EXISTS "Landlord updates own inspections" ON public.inspections;
CREATE POLICY "Landlord updates own inspections" ON public.inspections
FOR UPDATE
USING (
  (user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id AND p.landlord_id = auth.uid()
  )
)
WITH CHECK (
  (user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM contracts c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = inspections.contract_id AND p.landlord_id = auth.uid()
  )
);
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
GRANT ALL ON public.efi_charges TO service_role;
GRANT ALL ON public.efi_events TO service_role;
GRANT SELECT ON public.efi_charges TO authenticated;
CREATE POLICY "Manager sees contracts of managed properties"
ON public.contracts FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contracts.property_id AND p.manager_id = auth.uid()
  )
);

CREATE POLICY "Manager updates contracts of managed properties"
ON public.contracts FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contracts.property_id AND p.manager_id = auth.uid()
  )
);
ALTER TABLE public.efi_events ADD COLUMN IF NOT EXISTS error TEXT;
CREATE INDEX IF NOT EXISTS idx_efi_events_unprocessed ON public.efi_events(received_at DESC) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_efi_charges_txid ON public.efi_charges(txid);
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
UPDATE public.efi_charges SET status='ignored' WHERE txid !~ '^[a-zA-Z0-9]{26,35}$' AND status IN ('created','active','pending');
-- Add platform_admin role and restrict platform_settings writes to it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';

-- Tighten platform_settings: only platform_admin can write; managers keep read for UI needs.
DROP POLICY IF EXISTS "Managers can insert platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Managers can update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Managers can read platform settings" ON public.platform_settings;

CREATE POLICY "Platform admins manage platform settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Managers can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Generic audit trigger factory reused for contracts, installments, debt_agreements.
CREATE OR REPLACE FUNCTION public.log_generic_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_entity text := TG_TABLE_NAME;
  v_id text;
  v_ip text;
  v_ua text;
  v_email text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := v_entity || '.create';
    v_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := v_entity || '.update';
    v_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
          AND key NOT IN ('updated_at')
      )
    );
  ELSE
    v_action := v_entity || '.delete';
    v_id := (to_jsonb(OLD)->>'id');
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
    v_email := current_setting('request.jwt.claims', true)::json->>'email';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL; v_email := NULL;
  END;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity, entity_id, ip_address, user_agent, metadata)
  VALUES (auth.uid(), v_email, v_action, v_entity, v_id, v_ip, v_ua, COALESCE(v_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_generic_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_contracts ON public.contracts;
CREATE TRIGGER trg_audit_contracts
AFTER INSERT OR UPDATE OR DELETE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

DROP TRIGGER IF EXISTS trg_audit_installments ON public.installments;
CREATE TRIGGER trg_audit_installments
AFTER INSERT OR UPDATE OR DELETE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

DROP TRIGGER IF EXISTS trg_audit_debt_agreements ON public.debt_agreements;
CREATE TRIGGER trg_audit_debt_agreements
AFTER INSERT OR UPDATE OR DELETE ON public.debt_agreements
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();
CREATE TABLE public.support_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  client_message_id text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.support_chat_messages TO authenticated;
GRANT ALL ON public.support_chat_messages TO service_role;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own support chat"
  ON public.support_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support chat"
  ON public.support_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own support chat"
  ON public.support_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_support_chat_user_created ON public.support_chat_messages (user_id, created_at);

CREATE TRIGGER support_chat_messages_set_updated_at
  BEFORE UPDATE ON public.support_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media';

ALTER TABLE public.maintenances
  ADD CONSTRAINT maintenances_priority_check CHECK (priority IN ('alta','media','baixa'));-- ============ limpeza do chatbot ============
DROP TABLE IF EXISTS public.support_chat_messages CASCADE;

-- ============ colunas auxiliares ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.maintenances ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros';

-- ============ conversas ============
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('tenant_manager','tenant_landlord','landlord_manager')),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX chat_conversations_contract_kind_uidx
  ON public.chat_conversations (contract_id, kind) WHERE contract_id IS NOT NULL;

CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_label text NOT NULL DEFAULT 'membro',
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX chat_participants_user_idx ON public.chat_participants (user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid,
  is_system boolean NOT NULL DEFAULT false,
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance_id uuid REFERENCES public.maintenances(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_created_idx ON public.chat_messages (conversation_id, created_at);

GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT, UPDATE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- ============ helper ============
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants p
    WHERE p.conversation_id = _conversation_id AND p.user_id = _user_id
  )
$$;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conversations_select_participant" ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.is_chat_participant(id, auth.uid()));

CREATE POLICY "chat_participants_select_participant" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "chat_participants_update_own" ON public.chat_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_messages_select_participant" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "chat_messages_insert_participant" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND is_system = false
    AND public.is_chat_participant(conversation_id, auth.uid())
  );

-- ============ manter resumo da conversa ============
CREATE OR REPLACE FUNCTION public.chat_touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = CASE
           WHEN coalesce(NEW.content, '') <> '' THEN left(NEW.content, 140)
           WHEN jsonb_array_length(NEW.attachments) > 0 THEN 'Anexo enviado'
           ELSE 'Mensagem'
         END,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_chat_touch_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_touch_conversation();

-- ============ criação automática de conversas ============
CREATE OR REPLACE FUNCTION public.ensure_chat_conversations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT c.id AS contract_id,
           c.property_id,
           c.user_id AS manager_user_id,
           t.user_id_link AS tenant_user_id,
           p.landlord_id,
           coalesce(p.nickname, p.address) AS property_label
      FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      LEFT JOIN public.tenants t ON t.id = c.tenant_id
     WHERE c.deleted_at IS NULL
       AND (c.user_id = v_uid OR t.user_id_link = v_uid OR p.landlord_id = v_uid)
  LOOP
    -- inquilino <-> imobiliária/gestor
    IF r.tenant_user_id IS NOT NULL AND r.manager_user_id IS NOT NULL
       AND r.tenant_user_id <> r.manager_user_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'tenant_manager';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('tenant_manager', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.tenant_user_id, 'inquilino'), (v_conv, r.manager_user_id, 'imobiliaria')
      ON CONFLICT DO NOTHING;
    END IF;

    -- inquilino <-> proprietário
    IF r.tenant_user_id IS NOT NULL AND r.landlord_id IS NOT NULL
       AND r.tenant_user_id <> r.landlord_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'tenant_landlord';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('tenant_landlord', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.tenant_user_id, 'inquilino'), (v_conv, r.landlord_id, 'proprietario')
      ON CONFLICT DO NOTHING;
    END IF;

    -- proprietário <-> imobiliária
    IF r.landlord_id IS NOT NULL AND r.manager_user_id IS NOT NULL
       AND r.landlord_id <> r.manager_user_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'landlord_manager';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('landlord_manager', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.landlord_id, 'proprietario'), (v_conv, r.manager_user_id, 'imobiliaria')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_chat_conversations() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_chat_conversations() TO authenticated;

-- ============ manutenções refletidas no chat ============
CREATE OR REPLACE FUNCTION public.chat_broadcast_maintenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_text text;
  v_conv record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_text := 'Nova solicitação de manutenção: ' || NEW.title || ' (urgência: ' || NEW.priority || ')';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_text := 'Manutenção "' || NEW.title || '" atualizada para: ' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  FOR v_conv IN
    SELECT id FROM public.chat_conversations
     WHERE (NEW.contract_id IS NOT NULL AND contract_id = NEW.contract_id)
        OR (NEW.contract_id IS NULL AND property_id = NEW.property_id)
  LOOP
    INSERT INTO public.chat_messages (conversation_id, sender_user_id, is_system, content, maintenance_id)
    VALUES (v_conv.id, NULL, true, v_text, NEW.id);
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_chat_broadcast_maintenance
AFTER INSERT OR UPDATE ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.chat_broadcast_maintenance();

-- ============ realtime ============
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- ============ storage: anexos do chat ============
CREATE POLICY "chat_attachments_select_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_chat_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "chat_attachments_insert_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_chat_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');
-- 1. Contracts policies: scope to authenticated role
DROP POLICY IF EXISTS "Manager sees contracts of managed properties" ON public.contracts;
CREATE POLICY "Manager sees contracts of managed properties"
ON public.contracts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
);

DROP POLICY IF EXISTS "Manager updates contracts of managed properties" ON public.contracts;
CREATE POLICY "Manager updates contracts of managed properties"
ON public.contracts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = contracts.property_id AND p.manager_id = auth.uid())
);

-- 2. Fix mutable search_path on email queue helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, pg_temp;
ALTER TABLE public.efi_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.efi_events TO service_role;

-- Já existe select_own para authenticated, mas garantir GRANT

-- 3. Criar função de sanitização SQL básica para uso interno (opcional mas boa prática)
-- (O Supabase/PostgREST já lida com parâmetros via $1, $2, etc., mas triggers podem ser vulneráveis se usarem dynamic SQL mal sanitizado)

-- 4. Criar Trigger de Auditoria para alterações de contrato (exemplo de endurecimento)
CREATE OR REPLACE FUNCTION public.log_contract_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'update_contract', 'contracts', NEW.id, jsonb_build_object('old', old, 'new', NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_log_contract_changes ON public.contracts;
CREATE TRIGGER tr_log_contract_changes
  AFTER UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.log_contract_changes();

-- 5. Garantir que has_role não seja abusável
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 6. Otimizar Banco de Dados: Índices essenciais faltantes
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON public.properties(manager_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
-- 1. Ativar extensão necessária para busca textual (trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tentar criar o índice novamente após garantir a extensão
CREATE INDEX IF NOT EXISTS idx_tenants_full_name_trgm ON public.tenants USING gin (full_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- 3. Reaplica as políticas de service_role para tabelas de eventos (caso a falha anterior tenha abortado a transação)
DO $$
BEGIN
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'efi_events' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON public.efi_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Excluir da tabela user_roles se houver (previne erro de FK se não for cascade)
DELETE FROM public.user_roles WHERE user_id IN ('059ca7d8-147c-40ad-9b47-3d129089604c', '58c2cc03-cb13-4724-8ddb-77d7143cea96', 'b72b5333-2174-4e04-84d2-6e6edde76b1c');

-- Excluir perfis
DELETE FROM public.profiles WHERE id IN ('059ca7d8-147c-40ad-9b47-3d129089604c', '58c2cc03-cb13-4724-8ddb-77d7143cea96', 'b72b5333-2174-4e04-84d2-6e6edde76b1c');

-- Nota: A exclusão da tabela auth.users geralmente requer privilégios de superuser ou o uso do cliente admin do Supabase via código. 
-- Vou tentar remover o que for possível no schema public primeiro.
-- Ensure profile exists
INSERT INTO public.profiles (id, email, full_name) 
VALUES ('58c2cc03-cb13-4724-8ddb-77d7143cea96', 'azure.cosmeticos2025@gmail.com', 'Azure Cosméticos')
ON CONFLICT (id) DO UPDATE SET full_name = 'Azure Cosméticos';

-- Assign manager role
INSERT INTO public.user_roles (user_id, role) 
VALUES ('58c2cc03-cb13-4724-8ddb-77d7143cea96', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;-- Remove duplicatas mantendo o convite mais recente
DELETE FROM public.landlord_invites a
USING public.landlord_invites b
WHERE a.id < b.id
  AND a.email = b.email;

-- Agora adiciona a restrição de unicidade
ALTER TABLE public.landlord_invites ADD CONSTRAINT landlord_invites_email_key UNIQUE (email);-- Criação da política de inserção para gerentes (imobiliárias)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contracts' 
        AND policyname = 'Managers can insert contracts for their properties'
    ) THEN
        CREATE POLICY "Managers can insert contracts for their properties"
        ON public.contracts FOR INSERT TO authenticated
        WITH CHECK (
            has_role(auth.uid(), 'manager'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.properties p 
                WHERE p.id = property_id 
                AND p.manager_id = auth.uid()
            )
        );
    END IF;
END $$;
-- Primeiro, apagamos as parcelas vinculadas aos contratos do usuário
DELETE FROM public.installments 
WHERE contract_id IN (
    SELECT id FROM public.contracts WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de'
);

-- Depois, apagamos os contratos do usuário
DELETE FROM public.contracts 
WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de';
-- Delete installments associated with the user's contracts
DELETE FROM public.installments 
WHERE contract_id IN (
  SELECT id FROM public.contracts 
  WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de'
);

-- Delete the contracts themselves
DELETE FROM public.contracts 
WHERE user_id = 'd101d276-6dee-479a-996c-fcf60695e4de';

DROP TRIGGER IF EXISTS tr_log_contract_changes ON public.contracts;
DROP FUNCTION IF EXISTS public.log_contract_changes();

DROP POLICY IF EXISTS "Managers e owners veem cobranças da sua carteira" ON public.efi_charges;

CREATE POLICY "efi_charges_select_scoped"
ON public.efi_charges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.installments i
    JOIN public.contracts c ON c.id = i.contract_id
    JOIN public.properties p ON p.id = c.property_id
    WHERE i.id = efi_charges.installment_id
      AND (
        c.user_id = auth.uid()
        OR c.tenant_id = public.current_tenant_id()
        OR p.landlord_id = auth.uid()
        OR c.user_id = public.current_manager_id()
      )
  )
  OR efi_charges.manager_user_id = auth.uid()
  OR efi_charges.manager_user_id = public.current_manager_id()
);