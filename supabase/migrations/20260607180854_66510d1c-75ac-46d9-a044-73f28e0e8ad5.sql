
ALTER TABLE public.maintenances
  ADD COLUMN budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN budget_status text NOT NULL DEFAULT 'nenhum',
  ADD COLUMN budget_rent_deduction boolean NOT NULL DEFAULT false,
  ADD COLUMN budget_notes text,
  ADD COLUMN budget_decided_at timestamptz,
  ADD COLUMN budget_applied_installment_id uuid;
