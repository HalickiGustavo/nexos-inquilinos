
ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS evidence_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS provider_name text;

-- Storage RLS for maintenance-evidence bucket
CREATE POLICY "auth read maintenance-evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-evidence');

CREATE POLICY "auth upload maintenance-evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-evidence');

CREATE POLICY "auth delete own maintenance-evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'maintenance-evidence' AND owner = auth.uid());
