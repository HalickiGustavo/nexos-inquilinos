ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media';

ALTER TABLE public.maintenances
  ADD CONSTRAINT maintenances_priority_check CHECK (priority IN ('alta','media','baixa'));