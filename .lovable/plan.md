## Auditoria de Segurança e Banco de Dados

Análise completa via scanner de segurança, linter do Postgres, inspeção de policies/grants/índices e pg_stat_statements. Abaixo o que foi encontrado e o que proponho corrigir. **Nada será alterado até sua aprovação.**

---

### Achados por criticidade

**ALTO — Storage `property-images` aberto a qualquer autenticado**
Policy `property-images authenticated read` é apenas `bucket_id = 'property-images'`. Qualquer usuário logado (inclusive inquilinos de outras imobiliárias) consegue baixar fotos de qualquer imóvel.

**ALTO — INSERT no Storage sem filtro de bucket**
Policies `property-images owner insert` e `auth upload maintenance-evidence` têm `WITH CHECK = NULL`. Permitem upload em **qualquer bucket**, não só o pretendido.

**MÉDIO — `invite_token` exposto em `manager_members`**
Membros conseguem ler o `invite_token` de outros convites (policy SELECT atual devolve a linha inteira). Token deveria ser visível apenas no fluxo de aceitar convite.

**BAIXO — 3 SECURITY DEFINER executáveis por autenticados**
`has_role`, `current_tenant_id`, `current_manager_id`. Necessárias para RLS, mas o linter alerta. Vou restringir o `search_path` (já está) e revogar `EXECUTE` de `public`/`anon` mantendo `authenticated` (RLS depende delas). Risco real é mínimo — apenas calam o linter.

**Performance — falta de índices em FKs muito usadas**
`pg_stat_statements` mostra a query de `installments + contracts + properties + tenants` no topo. Faltam índices em: `installments.contract_id`, `installments.user_id`, `contracts.property_id`, `contracts.tenant_id`, `contracts.user_id`, `properties.user_id`, `maintenances.property_id`, `maintenances.user_id`, `maintenances.tenant_id`, `manager_members.member_user_id`, `manager_members.manager_user_id`.

---

### Correções propostas (uma migration única)

1. **Storage `property-images`** — substituir policy de SELECT por: dono do imóvel **OU** inquilino com contrato ativo nesse imóvel **OU** membro do manager dono. Feed XML dos portais continua via `service_role` (não afetado).
2. **Storage INSERT** — adicionar `WITH CHECK (bucket_id = '<nome>' AND ...)` em `property-images` e `maintenance-evidence`, exigindo dono ou contexto válido.
3. **`manager_members.invite_token`** — `REVOKE SELECT (invite_token) ... FROM authenticated`. Criar função `accept_manager_invite(_token)` SECURITY DEFINER para o fluxo de aceitar convite (única forma de “casar” token sem expô-lo).
4. **SECURITY DEFINER** — `REVOKE EXECUTE ... FROM PUBLIC, anon` em `has_role`, `current_tenant_id`, `current_manager_id`; manter para `authenticated`.
5. **Índices** (todos `CREATE INDEX IF NOT EXISTS`, não-CONCURRENTLY pois rodam em migration):
   - `installments(contract_id)`, `installments(user_id)`
   - `contracts(property_id)`, `contracts(tenant_id)`, `contracts(user_id)`
   - `properties(user_id)`
   - `maintenances(property_id)`, `maintenances(user_id)`, `maintenances(tenant_id)`
   - `manager_members(member_user_id)`, `manager_members(manager_user_id)`

---

### O que NÃO vou mexer

- Esquema de roles/`has_role`/RLS de tabelas — já está correto e auditado por `verify_security_invariants`.
- Webhook do Asaas — já usa `timingSafeEqual` e token.
- Endpoints `/api/public/hooks/*` — já validam `CRON_SECRET`.
- Validação de inputs Zod, reCAPTCHA, attacher de auth — ok.
- Frontend / design / regras de negócio — fora do escopo.

Aprovar para eu rodar a migration?
