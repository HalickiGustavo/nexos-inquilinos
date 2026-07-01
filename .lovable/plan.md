# Infraestrutura financeira — Stark Bank

Toda cobrança e repasse do sistema roda **exclusivamente** pela Stark Bank.
Sem SDK — chamadas HTTP diretas assinadas via `starkbank-ecdsa` (compatível
com Cloudflare Workers). Sem split nativo — a aplicação calcula o split e
envia PIX individuais.

## Fluxo

```
Inquilino → PIX / Boleto Stark → Conta principal NEXO
        ↓ (webhook)
/api/public/stark-webhook
        ↓ persiste evento + marca parcela paga + enfileira repasses
Cron `stark-process-payouts` (1 min)
        ↓ envia PIX para Imobiliária e Proprietário
Cron `stark-reconcile-charges` (15 min) — safety net
```

## Camadas (`src/lib/stark/`)

| Arquivo | Papel |
|---|---|
| `stark.server.ts`      | Cliente HTTP assinado ECDSA + verificação de webhook |
| `split-engine.ts`      | Cálculo puro do split (sem IO) |
| `charges.server.ts`    | PIX dinâmico e Boleto |
| `payouts.server.ts`    | PayoutService — envia PIX |
| `transfers.repo.server.ts` | Fila `payment_transfers` (enqueue/claim/markCompleted/Failed) |
| `webhook.server.ts`    | Valida evento, confirma cobrança via API, dispara split |
| `worker.server.ts`     | Drena fila + reconciliação PROCESSING |

Wrapper `src/lib/pix-split.functions.ts` mantém a API antiga
(`generateTripleSplitPix`, `checkPixPayment`) que o front consome.

## Tabelas

- `stark_charges` — cobranças emitidas (Pix/Boleto). Idempotente por `external_id`.
- `payment_transfers` — fila de repasses (`PENDING → PROCESSING → COMPLETED|FAILED`).
- `stark_events` — log cru dos webhooks (idempotência por `event_id`).

## Regras de segurança

- Webhook nunca envia PIX — só persiste e enfileira.
- Antes de fechar repasse, `worker.server.ts` reconsulta `/pix-request/{id}`.
- Retry com backoff exponencial em minutos (`attempts²`), até 5 tentativas.
- `external_id` obrigatório para idempotência em **cobrança** e **repasse**.

## Secrets

- `STARK_PROJECT_ID`
- `STARK_PRIVATE_KEY` (PEM EC secp256k1)
- `STARK_ENVIRONMENT` (`sandbox` | `production`)
- `STARK_WEBHOOK_SECRET` (usado só pelo endpoint de registro)

## Registrar webhook na Stark

Endpoint one-shot que cria a subscription na Stark apontando para o
webhook público da app. Chama-se via curl:

```bash
curl -X POST \
  -H "x-admin-token: $STARK_WEBHOOK_SECRET" \
  https://nexos-inquilinos.lovable.app/api/public/hooks/register-stark-webhook
```

Subscriptions criadas: `dynamic-brcode`, `boleto`, `pix-request`,
`brcode-payment`.

## Crons ativos (pg_cron)

| Job | Frequência | Endpoint |
|---|---|---|
| `stark-process-payouts`   | 1 min  | `/api/public/hooks/process-payout-queue` |
| `stark-reconcile-charges` | 15 min | `/api/public/hooks/reconcile-stark-charges` |
