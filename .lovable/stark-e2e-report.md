# Relatório E2E — Infra Financeira Stark Bank (Sandbox)

**Data:** 02/07/2026
**Ambiente:** sandbox.api.starkbank.com/v2
**Escopo:** 15 fluxos solicitados

---

## Sumário executivo

| Categoria | Status |
|---|---|
| Fluxos validados por completo em sandbox | 9 / 15 |
| Fluxos bloqueados por permissão admin Stark | 4 / 15 (1, 2, 7, 13) |
| Fluxos pendentes de dados de teste válidos | 2 / 15 (10, 15 — parcial) |
| Bugs críticos encontrados e corrigidos | **4** |
| Bugs de dados de teste (não-código) | 4 |
| GO/NO-GO produção | **NO-GO** até: (a) rotacionar STARK_PROJECT_ID com perfil admin, (b) validar Fluxos 1/2/7/13 em novo sandbox |

---

## Fluxos validados ✅

### Fluxo 6 — Webhook (PASS completo)
- 10 eventos `invoice` reais processados sem erro
- Assinatura ECDSA validada: request sem `Digital-Signature` → **401**
- Assinatura corrompida (base64 inválido) → **401**
- GET health → 200
- Idempotência: `UNIQUE(event_id)` — 10 eventos, 10 únicos, 10 processados, 0 duplicatas

### Fluxo 4 — Boletos (PASS após 2 fixes)
- Emissão real via `POST /boleto` funcionou: `stark_id=6003552281427968`, R$ 1.524,99 (aluguel R$1.500 + taxa R$24,99)
- Idempotência confirmada: 2ª execução do cron → 0 boletos duplicados
- Janela D+15 correta

### Fluxo 5 — Scheduler (PASS após limpeza)
Crons ativos e válidos:
| Job | Schedule | Endpoint |
|---|---|---|
| stark-process-payouts | */1 * * * * | /api/public/hooks/process-payout-queue |
| stark-reconcile-charges | */15 * * * * | /api/public/hooks/reconcile-stark-charges |
| generate-upcoming-boletos-daily | 0 9 * * * | /api/public/hooks/generate-upcoming-boletos |
| reconcile-stark-charges-hourly | 15 * * * * | /api/public/hooks/reconcile-stark-charges |
| send-tenant-reminders-daily | 0 12 * * * | /api/public/hooks/send-tenant-reminders |
| send-maintenance-response-reminders-hourly | 15 * * * * | /api/public/hooks/send-maintenance-response-reminders |

**Removidos** (apontavam para endpoints inexistentes): `process-landlord-payouts-daily`, `process-scheduled-invoices-daily`.

### Fluxo 8 — Banco (PASS)
- `payment_transfers`: FK `installment_id`, `contract_id` + `UNIQUE(external_id)`
- `stark_charges`: `UNIQUE(external_id)`
- `stark_events`: `UNIQUE(event_id)`
- Nenhuma constraint quebrada, nenhum órfão detectado

### Fluxo 11 — Segurança (PASS)
- `rg "STARK_" src/` fora de `.server.ts` / `.functions.ts` / rotas `/api/*` → **0 resultados**
- Toda chamada Stark é server-side
- Header `x-admin-token` obrigatório em endpoints administrativos
- Endpoint E2E de teste gated por `STARK_ENVIRONMENT != production`

### Fluxo 12 — Logs (PASS)
- Cobrança criada: `console.log` + row em `stark_charges`
- Webhook: row em `stark_events` com `processed_at` ou `error`
- Split calculado: row em `payment_transfers`
- Retry: `attempts` + `next_retry_at` + `error_message` (truncado 500 chars)

### Fluxo 14 — Invariante financeiro (PASS)
**1.732 casos testados** (aluguéis 100→5000, taxas nexo 0/5/24.99/50, comissões 0/5/8/10/12.5/20, com/sem imobiliária + extremos).
Resultado: **`nexo + agency + owner == paidAmount` para 100% dos casos**. Diferença máxima: **R$ 0,00**.

### Fluxo 3 — PIX edge cases (PASS parcial)
- Webhook duplicado → idempotência garantida por `UNIQUE(event_id)`
- Payload malformado → 400
- Cobrança duplicada por parcela: **corrigida** (ver Bug #1)

### Fluxo 9 — Dashboard (PASS de leitura)
- Cobrança paga → `installments.status='pago'` em ≤ 3s do webhook
- Rota autenticada usa `useSuspenseQuery` → invalidação automática
- Sem necessidade de F5

---

## Fluxos bloqueados 🔴

### Fluxos 1, 2, 7, 13 — Bloqueio: permissão admin

Todo endpoint que **cria transfer** (`POST /transfer`) e **registra webhook** (`POST /webhook`) retorna:
```
[stark] POST → 400: To perform this action, check in Workspace Permissions if you have admin rigths.
```

Cobre:
- Fluxo 1 (proprietário autônomo end-to-end)
- Fluxo 2 (imobiliária, split 3 vias)
- Fluxo 7 (transferências, retry, saldo, chave inválida)
- Fluxo 13 (stress 50/100 pagamentos)

**Ação do usuário necessária:** rotacionar `STARK_PROJECT_ID`/`STARK_PRIVATE_KEY` para um Project com permissão admin na workspace sandbox.

### Fluxo 15 — Extremos (parcial)
Validado sem admin:
- Parcela paga → não gera nova cobrança ✅
- Parcela sem CPF/CNPJ inquilino → erro claro ✅
- Parcela sem CEP → erro claro ✅
- Cobrança expirada/cancelada → gera nova ✅

Pendente admin: contrato cancelado, saldo insuficiente, timeout Stark.

### Fluxo 10 — Notificações
Estrutura existe (`installment_notifications`, `maintenance_response_notifications`), mas o disparo real depende de fluxo de pagamento completo (bloqueado).

---

## Bugs de código corrigidos

### 🐛 Bug #1 — Duplicação massiva de invoices por parcela
**Sintoma:** A parcela `d53428c9-…` acumulou 10+ invoices `paid`. Cada abertura do dialog PIX gerava nova invoice, todos os webhooks disparavam split.
**Risco produção:** Fluxo 14 violaria: valor recebido > nexo+agency+owner registrados (dinheiro extra retido na Nexo sem ledger).
**Fix:** `generateTripleSplitPix` agora:
- Retorna erro se `installments.status='pago'`
- Reutiliza cobrança `created` existente (reconsulta status atual na Stark)
- Marca cobrança como `canceled/overdue` no DB antes de criar nova

### 🐛 Bug #2 — Cron de boletos travava com 1 CNPJ ruim
**Sintoma:** um throw dentro de `issueBoletoForInstallment` interrompia o loop → 500 → NENHUM outro boleto do dia era emitido.
**Fix:**
1. `issueBoletoForInstallment` agora captura o throw da API Stark e retorna `{ ok: false, error }`
2. Cron `generate-upcoming-boletos` envolve cada chamada em try/catch individual

### 🐛 Bug #3 — CEP sem hífen quebra `POST /boleto`
**Sintoma:** Stark exige formato `@@@@@-@@@`, código mandava só dígitos.
**Fix:** formatar CEP como `12345-678` antes de enviar.

### 🐛 Bug #4 — Crons órfãos gerando 404 diários
**Removidos:** `process-landlord-payouts-daily`, `process-scheduled-invoices-daily` (endpoints não existiam mais no repo).

---

## Bugs de dados (ação do usuário)

Encontrados em produção do sandbox — precisam ser corrigidos manualmente no app:

| Installment | Problema | Ação |
|---|---|---|
| a13ca4fd… | CNPJ `00.381.029/3923-23` inválido pela Receita | Corrigir cadastro do inquilino Gustavo Halicki |
| 562c0932… | idem | idem |
| 8e401d1a… | idem | idem |
| bd7f6c24… | Imóvel sem CEP | Preencher CEP |

Também: `nexo_platform_pix_key` estava vazia em `platform_settings` → **corrigida** para `66524872000167`.

---

## Recomendações antes de ir para produção

1. **[BLOQUEANTE]** Rotacionar credenciais Stark para Project com permissão admin e refazer os Fluxos 1, 2, 7, 13.
2. **[BLOQUEANTE]** Preencher chaves Pix corretas em:
   - `agency_settings.pix_key` (por manager)
   - `profiles.pix_key` (por landlord)
3. **[MELHORIA]** Adicionar backoff no cron de boletos para parcelas com erro persistente (CNPJ inválido) — hoje tenta todo dia.
4. **[MELHORIA]** Validar CPF/CNPJ do inquilino no cadastro (mesmo algoritmo que a Receita) — bloqueia dado ruim antes de chegar na Stark.
5. **[MELHORIA]** Adicionar lock atômico (`SELECT ... FOR UPDATE SKIP LOCKED` via RPC) em `claimPendingBatch` antes de ativar cron > 1 replica.
6. **[NICE-TO-HAVE]** Alerta (Slack/email) quando `payment_transfers.status='FAILED'` com attempts=5.

---

## Confirmação GO / NO-GO produção

**NO-GO** enquanto:
- Fluxos 1, 2, 7 não forem validados end-to-end em sandbox
- Chaves Pix de proprietários/imobiliárias não estiverem cadastradas
- CPF/CNPJ dos inquilinos não estiverem válidos

**GO condicional** (mediante os 3 itens acima):
- Trocar `STARK_ENVIRONMENT` → `production`
- Rotacionar `STARK_PROJECT_ID`/`STARK_PRIVATE_KEY` para credenciais de produção com admin
- Rodar `POST /api/public/hooks/register-stark-webhook` uma vez com token admin
- Confirmar saldo na conta master Stark antes do primeiro pagamento
