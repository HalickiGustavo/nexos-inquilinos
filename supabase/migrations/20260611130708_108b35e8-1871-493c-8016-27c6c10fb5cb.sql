CREATE POLICY "Managers can insert platform settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Managers can update platform settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;