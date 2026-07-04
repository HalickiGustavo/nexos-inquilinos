
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
