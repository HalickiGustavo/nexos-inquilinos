# Auditoria de Segurança e Banco de Dados - NEXO

Relatório técnico de vulnerabilidades identificadas e correções aplicadas.

## Vulnerabilidades Corrigidas

### 1. Falha de Autorização: Execução Pública de Funções `SECURITY DEFINER` (Crítico)
- **Causa:** Diversas funções (ex: `has_role`, `accept_landlord_invite`) estavam com permissão de execução para a role `public`.
- **Correção:** Revogação total de acesso público e restrição para `authenticated` e `service_role`.

### 2. Exposição de Dados: Tabelas sem RLS Ativo (Médio)
- **Causa:** Tabelas de eventos de webhooks (`efi_events`, `stark_events`) estavam sem RLS, permitindo leitura direta se expostas.
- **Correção:** Ativação de RLS e criação de políticas restritas à `service_role`.

### 3. Vetor de Ataque: Rate Limiting Inexistente (Médio)
- **Causa:** Endpoints públicos como `/api/public/listings/xml` e `/api/public/efi-webhook` não tinham controle de frequência.
- **Correção:** Implementação de rate limiting em memória por IP (30 req/min para leads, 10 req/min para XML).

### 4. Integridade de Dados: Falta de Índices em Colunas Críticas (Performance)
- **Causa:** Colunas de filtro frequente (`due_date`, `status`, `manager_id`) não possuíam índices, gerando queries pesadas (N+1/Full Table Scan).
- **Correção:** Criação de índices B-tree em todas as colunas de busca e ordenação do dashboard.

### 5. Segurança de Infra: `search_path` Mutável em Funções Privilegiadas (Médio)
- **Causa:** Algumas funções `SECURITY DEFINER` não fixavam o `search_path`, permitindo ataques de sequestro de path.
- **Correção:** Fixação explícita de `SET search_path = public` em todas as funções sensíveis.

## Invariantes de Segurança Implementadas
- **Cross-tenant Isolation:** Todas as políticas de RLS agora verificam `auth.uid()` ou vínculos de `manager_id`.
- **Audit Logging:** Trigger automática para rastrear alterações críticas em contratos.
- **Self-Promotion Protection:** Políticas de `user_roles` impedem que um usuário altere sua própria role.

---
*Auditoria realizada em 06/08/2026.*
