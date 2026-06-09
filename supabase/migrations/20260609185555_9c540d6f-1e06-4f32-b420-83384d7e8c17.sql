
-- Add UPDATE policy on maintenance-evidence bucket (owner-only)
DROP POLICY IF EXISTS "auth update maintenance-evidence" ON storage.objects;
CREATE POLICY "auth update maintenance-evidence"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-evidence' AND owner = auth.uid())
WITH CHECK (bucket_id = 'maintenance-evidence' AND owner = auth.uid());

-- Fix realtime messages policy: deny non-maintenance topics
DROP POLICY IF EXISTS "maintenance chat channel access" ON realtime.messages;
CREATE POLICY "maintenance chat channel access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN (realtime.topic() LIKE 'mm:%') THEN EXISTS (
      SELECT 1 FROM public.maintenances m
      WHERE m.id::text = substring(realtime.topic() from 4)
        AND (
          m.user_id = auth.uid()
          OR m.tenant_id = public.current_tenant_id()
          OR m.user_id = public.current_manager_id()
        )
    )
    ELSE false
  END
);
