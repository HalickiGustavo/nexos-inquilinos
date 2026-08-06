-- 1. Fortalecer RLS: Garantir que efi_events e stark_events tenham RLS e apenas service_role possa ler
ALTER TABLE public.efi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stark_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.efi_events TO service_role;
GRANT ALL ON public.stark_events TO service_role;

-- 2. Corrigir permissão de asaas_accounts (select restrito ao dono)
-- Já existe select_own para authenticated, mas garantir GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_accounts TO authenticated;

-- 3. Criar função de sanitização SQL básica para uso interno (opcional mas boa prática)
-- (O Supabase/PostgREST já lida com parâmetros via $1, $2, etc., mas triggers podem ser vulneráveis se usarem dynamic SQL mal sanitizado)

-- 4. Criar Trigger de Auditoria para alterações de contrato (exemplo de endurecimento)
CREATE OR REPLACE FUNCTION public.log_contract_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, payload)
    VALUES (auth.uid(), 'update_contract', 'contracts', NEW.id, jsonb_build_object('old', old, 'new', NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_log_contract_changes ON public.contracts;
CREATE TRIGGER tr_log_contract_changes
  AFTER UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.log_contract_changes();

-- 5. Garantir que has_role não seja abusável
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 6. Otimizar Banco de Dados: Índices essenciais faltantes
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON public.properties(manager_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
