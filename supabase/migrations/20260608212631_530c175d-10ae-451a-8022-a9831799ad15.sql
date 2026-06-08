
-- 1) Maintenance evidence: tighten storage read policy
DROP POLICY IF EXISTS "auth read maintenance-evidence" ON storage.objects;
CREATE POLICY "auth read maintenance-evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'maintenance-evidence'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.maintenances m
        WHERE storage.objects.name = ANY (m.evidence_urls)
          AND (
            m.user_id = auth.uid()
            OR m.tenant_id = public.current_tenant_id()
            OR m.user_id = public.current_manager_id()
          )
      )
    )
  );

-- 2) Maintenance evidence: tighten upload policy to own folder
DROP POLICY IF EXISTS "auth upload maintenance-evidence" ON storage.objects;
CREATE POLICY "auth upload maintenance-evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Platform settings: restrict reads to managers only
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Managers can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- 4) Realtime: restrict maintenance_messages channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance chat channel access" ON realtime.messages;
CREATE POLICY "maintenance chat channel access"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'mm:%' THEN EXISTS (
        SELECT 1 FROM public.maintenances m
        WHERE m.id::text = substring(realtime.topic() from 4)
          AND (
            m.user_id = auth.uid()
            OR m.tenant_id = public.current_tenant_id()
            OR m.user_id = public.current_manager_id()
          )
      )
      ELSE true
    END
  );
