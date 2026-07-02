
ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenances_contract_id ON public.maintenances(contract_id);

-- Backfill: prefer contract matching property + tenant; fall back to active contract for property
UPDATE public.maintenances m
SET contract_id = c.id
FROM public.contracts c
WHERE m.contract_id IS NULL
  AND c.property_id = m.property_id
  AND c.deleted_at IS NULL
  AND (m.tenant_id IS NULL OR c.tenant_id = m.tenant_id)
  AND c.id = (
    SELECT c2.id FROM public.contracts c2
    WHERE c2.property_id = m.property_id
      AND c2.deleted_at IS NULL
      AND (m.tenant_id IS NULL OR c2.tenant_id = m.tenant_id)
    ORDER BY (c2.active) DESC,
             (c2.start_date <= m.created_at::date AND c2.end_date >= m.created_at::date) DESC,
             c2.start_date DESC
    LIMIT 1
  );

-- Trigger: auto-fill contract_id on insert when omitted
CREATE OR REPLACE FUNCTION public.set_maintenance_contract_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_id IS NULL THEN
    SELECT c.id INTO NEW.contract_id
    FROM public.contracts c
    WHERE c.property_id = NEW.property_id
      AND c.deleted_at IS NULL
      AND (NEW.tenant_id IS NULL OR c.tenant_id = NEW.tenant_id)
    ORDER BY (c.active) DESC, c.start_date DESC
    LIMIT 1;
  END IF;

  -- Keep tenant_id consistent when a contract is chosen
  IF NEW.contract_id IS NOT NULL AND NEW.tenant_id IS NULL THEN
    SELECT c.tenant_id INTO NEW.tenant_id
    FROM public.contracts c WHERE c.id = NEW.contract_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_maintenance_contract_id ON public.maintenances;
CREATE TRIGGER trg_set_maintenance_contract_id
BEFORE INSERT ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.set_maintenance_contract_id();
