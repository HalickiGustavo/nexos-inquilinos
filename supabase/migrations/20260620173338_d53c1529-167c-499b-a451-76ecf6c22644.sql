
-- 1) Add phone to profiles (nullable, owners/managers fill in)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2) Tracking table for maintenance-response reminders
CREATE TABLE IF NOT EXISTS public.maintenance_response_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id uuid NOT NULL REFERENCES public.maintenances(id) ON DELETE CASCADE,
  last_tenant_message_id uuid NOT NULL REFERENCES public.maintenance_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_id, last_tenant_message_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_mrn_maintenance ON public.maintenance_response_notifications(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_mrn_user ON public.maintenance_response_notifications(user_id);

GRANT SELECT ON public.maintenance_response_notifications TO authenticated;
GRANT ALL ON public.maintenance_response_notifications TO service_role;

ALTER TABLE public.maintenance_response_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners and managers read their maintenance response notifs"
ON public.maintenance_response_notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = public.current_manager_id()
);
