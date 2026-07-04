
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
