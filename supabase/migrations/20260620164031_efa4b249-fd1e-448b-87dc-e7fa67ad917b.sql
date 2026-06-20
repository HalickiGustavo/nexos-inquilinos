
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
