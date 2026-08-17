-- =========================================================================
-- NEXO FULL SCHEMA - RECONSTRUÍDO DO ZERO
-- =========================================================================

-- 1. Extensões e Tipos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE public.property_type AS ENUM ('casa', 'apartamento', 'comercial', 'terreno', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.property_status AS ENUM ('disponivel', 'alugado', 'manutencao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.readjustment_index AS ENUM ('IGP-M', 'IPCA', 'INCC', 'nenhum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.installment_status AS ENUM ('pendente', 'pago', 'atrasado', 'divergente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.maintenance_status AS ENUM ('pendente', 'em_andamento', 'concluido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.maintenance_responsible AS ENUM ('proprietario', 'inquilino');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('owner', 'tenant', 'manager', 'platform_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Funções Básicas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END; $$;

-- 3. Tabelas Principais
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    pix_key TEXT,
    pix_key_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    landlord_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id_link UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    document TEXT,
    email TEXT,
    phone TEXT,
    emergency_contact TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
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
    late_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 2.00,
    late_interest_percent NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    extra_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_date TIMESTAMPTZ,
    status public.installment_status NOT NULL DEFAULT 'pendente',
    boleto_url TEXT,
    pix_qrcode TEXT,
    pix_payload TEXT,
    barcode TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 4. Efí Bank Tables
CREATE TABLE IF NOT EXISTS public.efi_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id TEXT,
    api_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    onboarding_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.efi_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installment_id UUID REFERENCES public.installments(id) ON DELETE CASCADE,
    manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'pix',
    status TEXT NOT NULL DEFAULT 'created',
    amount NUMERIC NOT NULL,
    txid TEXT UNIQUE,
    loc_id BIGINT,
    brcode TEXT,
    qrcode_image_base64 TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RLS and Grants (Padrão)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END LOOP;
END $$;

-- 6. Políticas de Exemplo (Simplificadas para evitar recursão)
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 7. Triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_installments_updated BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_efi_accounts_updated BEFORE UPDATE ON public.efi_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_efi_charges_updated BEFORE UPDATE ON public.efi_charges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 8. Funções de Auditoria e Segurança
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see all audit logs" ON public.audit_logs FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'platform_admin')));

-- 9. Tabelas Adicionais
CREATE TABLE IF NOT EXISTS public.maintenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    status public.maintenance_status NOT NULL DEFAULT 'pendente',
    priority TEXT NOT NULL DEFAULT 'media',
    responsible public.maintenance_responsible NOT NULL DEFAULT 'proprietario',
    scheduled_date DATE,
    completed_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manager_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (manager_user_id, member_user_id)
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Funções Úteis
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE user_id_link = auth.uid() LIMIT 1
$$;

-- 11. Triggers de Negócio
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Garantindo Grants em todas as tabelas criadas por último
GRANT ALL ON public.maintenances TO authenticated;
GRANT ALL ON public.manager_members TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.efi_charges TO authenticated;
GRANT ALL ON public.efi_accounts TO authenticated;

