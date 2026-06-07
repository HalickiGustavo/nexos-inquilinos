
# Integração Asaas — Boletos com Split para o NEXO

## Visão geral

- **Ambiente:** Sandbox (`https://api-sandbox.asaas.com/v3`). Depois promovemos para produção trocando apenas a chave.
- **Modelo:** White-label com **Asaas Accounts (subcontas)**. O NEXO é a conta-mãe. Cada imobiliária (owner) vira uma subconta criada via API; o `walletId` dela fica salvo no banco.
- **Cobrança:** Boleto + Pix gerados pela conta-mãe em nome da subconta da imobiliária.
- **Split:** Valor fixo do NEXO (ex.: R$ 9,90 por boleto pago) cai automaticamente na nossa carteira; o restante vai para a subconta da imobiliária.
- **Baixa:** Webhook `/api/public/asaas-webhook` atualiza `installments.status = 'pago'` em tempo real.

## Secrets necessários

Vou pedir via `add_secret` (entrada segura, você cola os valores):

1. **`ASAAS_API_KEY`** — chave principal do **sandbox** da sua conta-mãe NEXO. Pegue em https://sandbox.asaas.com → Integrações → Gerar nova chave de API.
2. **`ASAAS_WEBHOOK_TOKEN`** — token de autenticação do webhook (você inventa uma string forte; depois cola no painel Asaas → Configurações → Notificações → Webhook).
3. **`ASAAS_NEXO_WALLET_ID`** — `walletId` da SUA conta NEXO (aparece em Minha Conta → Integrações). É para onde o split do NEXO é enviado.
4. **`ASAAS_NEXO_FEE`** — valor fixo da mensalidade NEXO por boleto pago (ex.: `9.90`). Fica como secret para você ajustar sem deploy.

> Observação: Asaas não é um connector nativo do Lovable, então uso secrets diretos (são chamados via `process.env` em server functions).

## Como funciona o Split na Asaas

A API `POST /v3/payments` aceita um campo `split: [{ walletId, fixedValue }]`. Quando o pagamento é confirmado, o Asaas deposita automaticamente o `fixedValue` na carteira do `walletId` informado e o restante fica com o emissor da cobrança (a subconta da imobiliária).

Para um aluguel de R$ 2.000 com `ASAAS_NEXO_FEE = 9.90`:
- Boleto emitido: **R$ 2.000,00** (inquilino paga o valor cheio do aluguel — sua taxa não infla o boleto, sai do bolo).
- Imobiliária recebe: R$ 1.990,10
- NEXO recebe: R$ 9,90

> Se preferir embutir a mensalidade **somando** ao aluguel (ex.: R$ 2.009,90 no boleto), basta inverter no código — me avise no review do plano. O padrão que vou implementar é "embutido no valor", como você descreveu.

## Mudanças no banco (migração)

Tabela nova `asaas_accounts` (subconta por owner/imobiliária):
- `user_id` (owner), `asaas_account_id`, `api_key` (chave da subconta — opcional, usamos a chave-mãe na maioria dos casos), `wallet_id`, `status` (pending/active), `onboarding_url`.

Tabela nova `asaas_customers` (cliente Asaas por inquilino):
- `tenant_id`, `asaas_customer_id`.

Colunas em `installments`:
- `asaas_payment_id`, `boleto_url`, `pix_qrcode`, `pix_payload`, `barcode`.

RLS: owner vê apenas seus registros; tenant lê `boleto_url/pix_*` apenas das parcelas do contrato dele (já coberto pela policy existente via `current_tenant_id()`).

## Server functions (`src/lib/asaas.functions.ts`)

Todas usam `requireSupabaseAuth` e chamam `https://api-sandbox.asaas.com/v3` com header `access_token: process.env.ASAAS_API_KEY`.

1. `createAsaasSubaccount()` — `POST /v3/accounts` para o owner logado (envia nome, CPF/CNPJ, email da imobiliária). Salva `accountId` + `walletId` em `asaas_accounts`.
2. `ensureAsaasCustomer(tenantId)` — `POST /v3/customers` se ainda não existe.
3. `generateBoleto(installmentId)` — `POST /v3/payments` com:
   ```json
   {
     "customer": "<asaas_customer_id>",
     "billingType": "BOLETO",  // ou "PIX" / "UNDEFINED" p/ múltiplos
     "value": 2000.00,
     "dueDate": "2026-07-10",
     "split": [{ "walletId": "<ASAAS_NEXO_WALLET_ID>", "fixedValue": 9.90 }]
   }
   ```
   Persiste `asaas_payment_id`, `boleto_url`, dados do Pix em `installments`.
4. `getPixQrCode(paymentId)` — `GET /v3/payments/{id}/pixQrCode` (para mostrar QR no app do inquilino).

## Server route (webhook) `src/routes/api/public/asaas-webhook.ts`

- `POST` recebe payload Asaas.
- Valida header `asaas-access-token === process.env.ASAAS_WEBHOOK_TOKEN` (responde 401 se diferente).
- Eventos tratados: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`.
- Usa `supabaseAdmin` para atualizar `installments` por `asaas_payment_id` (status pago + `payment_date` + `paid_amount`).

URL para colar no painel Asaas:
`https://nexos-inquilinos.lovable.app/api/public/asaas-webhook`

## UI

**Owner (`/_authenticated/`):**
- Card em `/dashboard` ou nova página `/integracoes`: "Conectar conta Asaas". Mostra status (pending/active) e botão "Criar subconta" → chama `createAsaasSubaccount`.
- Em `financials.tsx`: botão "Gerar boleto" por parcela pendente. Após gerar, mostra link "Abrir boleto" e copiar linha digitável.

**Tenant (`/_authenticated/tenant/financeiro`):**
- Substituir o Pix mock pelos dados reais: `pix_payload` no botão "Copiar Pix", QR Code via `<img>` data URL, "Abrir boleto" abre `boleto_url`.

## Ordem de execução (após você aprovar)

1. `add_secret` dos 4 secrets acima.
2. Migração do banco (tabelas + colunas + RLS + GRANTs).
3. `src/lib/asaas.server.ts` (cliente HTTP) + `asaas.functions.ts` (server fns).
4. Webhook em `api/public/asaas-webhook.ts`.
5. UI owner (onboarding subconta + botão gerar boleto).
6. UI tenant (boleto/Pix reais no lugar do mock).
7. Instruções finais para você configurar o webhook no painel Asaas.

## Pendências / pontos para confirmar

- **Split somando vs embutido:** vou implementar **embutido** (boleto = valor do aluguel; nossa taxa sai do bolo da imobiliária). Confirma?
- **Subconta exige documentos KYC** (CPF/CNPJ, endereço, etc.) que a Asaas valida. Em sandbox passa fácil; em produção a imobiliária precisa completar o onboarding via `onboardingUrl` que a API devolve.
- **Asaas Accounts no sandbox** às vezes exige habilitação manual da feature na sua conta — se a chamada `POST /v3/accounts` retornar 403, abra um ticket no suporte Asaas pedindo "habilitar Accounts" no seu sandbox.
