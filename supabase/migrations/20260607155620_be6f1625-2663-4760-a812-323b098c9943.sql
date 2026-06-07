ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS late_fee_percent numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS daily_interest_percent numeric NOT NULL DEFAULT 0.033;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS late_charges numeric NOT NULL DEFAULT 0;