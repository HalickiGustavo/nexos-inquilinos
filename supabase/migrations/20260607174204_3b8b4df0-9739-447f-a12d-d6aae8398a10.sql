
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS variable_expenses jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS default_management_fee_percent numeric NOT NULL DEFAULT 10;
