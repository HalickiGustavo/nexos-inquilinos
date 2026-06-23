
-- 1) audit_logs SELECT: restringe ao próprio dono (fecha bypass via current_manager_id)
DROP POLICY IF EXISTS "users read their own audit logs" ON public.audit_logs;

CREATE POLICY "users read their own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'tenant'::app_role)
    OR has_role(auth.uid(), 'landlord'::app_role)
  )
);

-- 2) landlord_invites: oculta a coluna invite_token de roles não-privilegiadas.
-- O fluxo de aceitação continua via accept_landlord_invite (SECURITY DEFINER),
-- usando o token recebido no link de convite — nunca lido do banco pelo cliente.
REVOKE SELECT (invite_token) ON public.landlord_invites FROM authenticated;
REVOKE SELECT (invite_token) ON public.landlord_invites FROM anon;
