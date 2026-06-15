ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS integration_imovelweb_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integration_zap_connected boolean NOT NULL DEFAULT false;