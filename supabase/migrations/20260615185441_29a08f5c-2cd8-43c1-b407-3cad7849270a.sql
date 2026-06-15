-- Transaction type enum
DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('Aluguel', 'Venda');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tipo_transacao public.transaction_type NOT NULL DEFAULT 'Aluguel',
  ADD COLUMN IF NOT EXISTS valor_aluguel numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_venda numeric(12,2),
  ADD COLUMN IF NOT EXISTS publish_imovelweb boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_zap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bedrooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bathrooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS description text;

-- Integration token on profiles (per-agency token)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS integration_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_integration_token_idx ON public.profiles(integration_token);

-- Backfill any nulls (defensive, though NOT NULL DEFAULT covers new rows)
UPDATE public.profiles SET integration_token = gen_random_uuid() WHERE integration_token IS NULL;

-- Photos table
CREATE TABLE IF NOT EXISTS public.property_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_photos_property_idx ON public.property_photos(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_photos TO authenticated;
GRANT ALL ON public.property_photos TO service_role;

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages photos" ON public.property_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);