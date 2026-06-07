
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
