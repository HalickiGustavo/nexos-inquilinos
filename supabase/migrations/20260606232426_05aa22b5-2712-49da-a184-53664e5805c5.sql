
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
