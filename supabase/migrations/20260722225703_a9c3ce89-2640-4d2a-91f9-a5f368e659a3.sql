
-- Tighten platform_settings: only platform_admin can write; managers keep read for UI needs.
DROP POLICY IF EXISTS "Managers can insert platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Managers can update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Managers can read platform settings" ON public.platform_settings;

CREATE POLICY "Platform admins manage platform settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Managers can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
  );
