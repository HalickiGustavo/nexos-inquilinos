
-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'outros',
  custom_category TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  file_ext TEXT,
  document_date DATE,
  expires_at DATE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  maintenance_id UUID REFERENCES public.maintenances(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents select" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own documents insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own documents update" ON public.documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own documents delete" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_documents_user ON public.documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_property ON public.documents(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_contract ON public.documents(contract_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_expires ON public.documents(expires_at) WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Document events (history)
CREATE TABLE public.document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_events TO authenticated;
GRANT ALL ON public.document_events TO service_role;

ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own document events" ON public.document_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users insert own document events" ON public.document_events
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_events.document_id AND d.user_id = auth.uid())
  );

CREATE INDEX idx_document_events_document ON public.document_events(document_id, created_at DESC);
