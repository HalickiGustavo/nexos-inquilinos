ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_inspections_contract ON public.inspections(contract_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user ON public.inspections(user_id);