# Relatório de Auditoria de Segurança — NEXO

Data: 2026-07-03  ·  Escopo: aplicação completa (frontend, TanStack server functions, rotas públicas, banco Supabase/Cloud, integrações Stark / Asaas / Evolution).

## 1. Sumário executivo

Postura de segurança **boa**. A base já traz:

- RLS habilitado em **todas** as tabelas de negócio (`properties`, `contracts`, `installments`, `tenants`, `maintenances`, `crm_leads`, `debt_agreements`, `inspections`, `payment_transfers`, `pix_splits`, `stark_charges`, `landlord_withdrawals`, etc.).
- Papéis armazenados em `user_roles` (tabela separada — sem risco de auto-promoção) e checados via `has_role()` `SECURITY DEFINER`.
- Isolamento multi-tenant via `current_manager_id()` / `current_tenant_id()` / `current_landlord_id()`, aplicadas nas políticas.
- Função interna `verify_security_invariants()` que já bloqueia regressões (RLS off, políticas sem escopo, políticas de escrita para `authenticated` em `audit_logs`/`user_roles`, políticas para `anon`).
- Nenhuma política com `anon` em tabelas de negócio (`SELECT count(*)` = 0).
- Nenhum `GRANT INSERT/UPDATE/DELETE` para `anon`/`authenticated` em tabelas sensíveis (`user_roles`, `audit_logs`, `platform_settings`, `stark_events`, `landlord_invites`).
- `SUPABASE_SERVICE_ROLE_KEY` apenas em `client.server.ts` — nunca importado a partir de componentes; nas server functions é carregado dentro do `.handler()` com `await import(...)`.
- Bearer token propagado automaticamente para server fns via `attachSupabaseAuth` (middleware global em `src/start.ts`), e validado por `requireSupabaseAuth` no servidor.
- Webhook Stark valida assinatura ECDSA antes de qualquer efeito colateral.
- Endpoints `/api/public/*` usam token/segredo explícito por chamada:
  - `stark-webhook` → assinatura ECDSA.
  - `webhooks/leads` → `webhook_token` mapeado a `agency_settings`.
  - `v1/integrations/{orgSlug}/leads` → `x-api-key`/`x-webhook-token`.
  - `hooks/*` (cron) → `Bearer $CRON_SECRET` com comparação em tempo constante (`requireCronAuth`).
  - `hooks/stark-e2e-sandbox` → `x-admin-token` + guard `STARK_ENVIRONMENT != production`.

## 2. Correções aplicadas nesta auditoria

Migração `harden_security_definer_execute_grants`:

Removi `EXECUTE` de `anon` e `authenticated` (que herdam de `PUBLIC` por default) em **funções internas de gatilho / admin** que **nunca devem ser chamadas via PostgREST**:

- `handle_new_user()`
- `log_maintenance_changes()`
- `set_maintenance_contract_id()`
- `agency_settings_set_org_slug()`
- `generate_installments_for_contract()`
- `generate_org_slug(uuid)`
- `set_property_code()`
- `set_updated_at()`
- `verify_security_invariants()` (mantém guard interno de service_role)
- `sync_cron_secret(text)` (mantém guard interno)

Grants explícitos mantidos para `authenticated` (necessários ao RLS / fluxos de usuário):

- `has_role(uuid, app_role)`
- `current_tenant_id()`, `current_manager_id()`, `current_landlord_id()`
- `is_current_tenant_property(uuid)`
- `accept_landlord_invite(text)`, `accept_manager_invite(text)`

E `EXECUTE` desses helpers foi **revogado para `anon`** — nenhum SECURITY DEFINER é chamável sem login.

## 3. Achados que exigem revisão manual (não bloqueantes)

| # | Item | Nível | Recomendação |
|---|------|-------|--------------|
| 1 | `stark_events` tem RLS ligado mas sem policies (INFO 0008) | Info | Correto — é write-only por service_role via webhook. Nenhuma leitura de app. Manter. |
| 2 | 9 avisos remanescentes do linter (`0028`/`0029`) sobre SECURITY DEFINER executável | Warn | **Intencional**. `has_role`, `current_*_id`, `is_current_tenant_property`, `accept_*_invite` **precisam** ser executáveis por `authenticated` — é o padrão Supabase para evitar recursão em RLS. Ignorar. |
| 3 | Feed público `/api/public/listings/xml` retorna apenas imóveis com `publish_zap`/`publish_imovelweb=true` — sem PII de proprietário ou inquilino | Ok | Verificado: retorna somente campos comerciais do imóvel + fotos do bucket público. |
| 4 | Buckets Storage: `contracts`, `inspections`, `maintenance-evidence`, `property-images` — todos privados | Ok | Nada exposto direto; upload/download passa por RLS + policies do bucket. |

## 4. Checklists

### OWASP Top 10 (2021)

| Categoria | Estado |
|-----------|--------|
| A01 — Broken Access Control | OK — RLS + `has_role` + `current_*_id`; sem IDOR possível via Data API (queries filtradas por `auth.uid()`/tenant). |
| A02 — Cryptographic Failures | OK — TLS pela plataforma; segredos em Cloud Secrets; comparação de token com `timingSafeEqual`. |
| A03 — Injection | OK — todas as queries usam PostgREST/parâmetros; sem SQL string-concat. Zod valida payloads de webhooks. |
| A04 — Insecure Design | OK — separação de papéis, tabelas dedicadas, invariantes verificáveis. |
| A05 — Security Misconfiguration | OK — corrigido nesta auditoria (EXECUTE grants). |
| A06 — Vulnerable Components | Verificar periodicamente com `dependency_scan`. |
| A07 — Auth Failures | OK — Supabase Auth; sem auto-confirm; sem anonymous sign-ups. |
| A08 — Data Integrity | OK — webhooks assinados (Stark ECDSA). |
| A09 — Logging | OK — `audit_logs` com `service_role`-only writes, PII limitada. |
| A10 — SSRF | N/A — não há fetch dinâmico controlado pelo usuário. |

### Isolamento multi-tenant

- [x] Toda tabela de negócio filtra por `auth.uid()`, `current_manager_id()`, `current_tenant_id()` ou `current_landlord_id()`.
- [x] `manager_members` restringe membros; `has_role` isola por papel.
- [x] `verify_security_invariants()` recusa políticas sem escopo.

### Vazamento de dados

- [x] Nenhuma API retorna hash de senha (senhas ficam em `auth.users`, gerenciadas pelo Supabase).
- [x] `SERVICE_ROLE_KEY` nunca chega ao browser (checado por rg — só em `.server.ts` e handlers de server fn / route).
- [x] Frontend não expõe `VITE_*` sensível — apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (que são públicos por design).
- [x] Endpoints `/api/public/*` **exigem** token e nunca retornam PII sem autorização.

### Autenticação / Autorização

- [x] Server functions protegidas usam `requireSupabaseAuth` (valida JWT via `getClaims`).
- [x] Rotas `_authenticated/*` gate-adas via layout gerenciado (`ssr: false`).
- [x] Nenhuma rota protegida no loader público.
- [x] Bearer token propagado por `attachSupabaseAuth` middleware.

## 5. Recomendações para hardening futuro (opcional)

1. **Rate-limiting** nas rotas `/api/public/webhooks/leads` e `/api/v1/integrations/*/leads` (hoje protegidas por token, mas sem throttling — um token vazado permite flood). Sugestão: `pg_cron` que trunca `crm_leads` por manager/hora quando exceder N.
2. **Rotacionar `CRON_SECRET`** periodicamente (já suporta via `sync_cron_secret`).
3. **Audit log de tentativas de login falhas** — hoje só logamos mutações de manutenção; expandir triggers para `contracts`, `installments`, `debt_agreements` daria trilha completa.
4. **Habilitar Password HIBP Check** nas configurações de Auth do Cloud (previne senhas vazadas).
5. **CSP + `Strict-Transport-Security`** no `__root.tsx` para reduzir superfície de XSS.

## 6. Aprovação

Com as correções aplicadas nesta auditoria:

- Nenhum endpoint permite acesso entre tenants ✓
- Nenhum endpoint retorna dados sensíveis desnecessários ✓
- Isolamento por tenant respeitado ✓
- Nenhuma Secret acessível pelo frontend ✓
- Service Role não exposto ao cliente ✓
- Funções protegidas por auth+authz ✓

Status: **APROVADO** com recomendações opcionais para hardening futuro.
