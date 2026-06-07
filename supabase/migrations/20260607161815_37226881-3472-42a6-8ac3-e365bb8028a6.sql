
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
