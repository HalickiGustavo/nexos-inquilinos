
DROP POLICY IF EXISTS "managers and owners read audit logs" ON public.audit_logs;

CREATE POLICY "users read their own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND user_id = public.current_manager_id()
  )
);
