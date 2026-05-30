
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
