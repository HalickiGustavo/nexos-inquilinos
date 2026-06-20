
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
