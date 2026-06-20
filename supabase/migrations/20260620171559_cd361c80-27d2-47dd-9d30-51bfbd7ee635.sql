
-- =========================================================
-- 1) STORAGE: property-images SELECT mais restrita
-- =========================================================
DROP POLICY IF EXISTS "property-images authenticated read" ON storage.objects;

CREATE POLICY "property-images scoped read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE (p.id)::text = (storage.foldername(objects.name))[1]
      AND (
        p.user_id = auth.uid()
        OR p.user_id = public.current_manager_id()
        OR EXISTS (
          SELECT 1 FROM public.contracts c
          WHERE c.property_id = p.id
            AND c.tenant_id = public.current_tenant_id()
        )
      )
  )
);

-- =========================================================
-- 2) STORAGE: INSERTs com WITH CHECK adequado
-- =========================================================
DROP POLICY IF EXISTS "property-images owner insert" ON storage.objects;
CREATE POLICY "property-images owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE (p.id)::text = (storage.foldername(objects.name))[1]
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "auth upload maintenance-evidence" ON storage.objects;
CREATE POLICY "auth upload maintenance-evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-evidence'
  AND owner = auth.uid()
);

-- =========================================================
-- 3) manager_members.invite_token: esconder de leitura
-- =========================================================
REVOKE SELECT (invite_token) ON public.manager_members FROM authenticated, anon;

-- Função para aceitar convite sem expor o token
CREATE OR REPLACE FUNCTION public.accept_manager_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.manager_members
     SET member_user_id = auth.uid(),
         status = 'ativo',
         accepted_at = now(),
         invite_token = NULL
   WHERE invite_token = _token
     AND status IN ('pendente', 'convidado')
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_used_token';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_manager_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_manager_invite(text) TO authenticated;

-- =========================================================
-- 4) SECURITY DEFINER: tirar de PUBLIC/anon
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_manager_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_manager_id() TO authenticated;

-- =========================================================
-- 5) ÍNDICES (perf) — FK heavy
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_installments_contract_id ON public.installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_installments_user_id     ON public.installments(user_id);

CREATE INDEX IF NOT EXISTS idx_contracts_property_id ON public.contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id   ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id     ON public.contracts(user_id);

CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);

CREATE INDEX IF NOT EXISTS idx_maintenances_property_id ON public.maintenances(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_user_id     ON public.maintenances(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_tenant_id   ON public.maintenances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_manager_members_member  ON public.manager_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_members_manager ON public.manager_members(manager_user_id);
