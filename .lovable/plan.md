# Migração Efí → Stark Bank

Substituição total da infraestrutura financeira. Toda cobrança e repasse passa pela Stark, com split calculado pela aplicação (sem split nativo).

## 1. Remoção da Efí

Apagar todo código, tipos, rotas, secrets e referências:
- `src/lib/pix-split.functions.ts` (stub atual), `src/lib/landlord-payouts.functions.ts` (usa Asaas — será refeito para Stark)
- Qualquer campo/menção `efi_*`, `EFI_*`, "Bolix", split nativo
- Secrets Efí (nenhum ativo hoje, apenas garantir)
- Colunas legadas (`efi_account_number`, `agency_efi_account_number`, tabela `efi_payouts`) — DROP em migração
- Docs `.lovable/plan.md` reescrito para Stark

Asaas: como o usuário disse "esqueça Efí" e agora quer Stark como único provedor, também removo o pipeline Asaas de cobrança/repasse (`asaas.functions.ts`, `asaas.server.ts`, webhook, painéis KYC/subconta, `PainelRepasses`, `AsaasBankAndKycPanel`, rotas `/admin.configuracoes.subconta`, `/admin.integracoes` Asaas, `landlord-payouts` Asaas). Mantenho apenas as tabelas `asaas_*` sem uso ativo (drop opcional posterior) para não perder histórico.

## 2. Nova arquitetura (camadas)

```
src/lib/stark/
  stark.server.ts          → cliente HTTP assinado ECDSA (Stark Bank REST v2)
  charges.server.ts        → criação PIX Dinâmico + Boleto (BrcodePreview / DynamicBrcode / BrcodePayment; Boleto)
  payouts.server.ts        → PayoutService: envia PIX (PixRequest)
  split-engine.ts          → SplitEngine puro (cálculo determinístico)
  webhook.server.ts        → WebhookService (verificação assinatura + persistência evento)
  transfers.repo.server.ts → TransferRepository (payment_transfers)

src/lib/charges.functions.ts    → serverFn: generateChargeForInstallment(installmentId)
src/lib/payouts.functions.ts    → serverFn admin: retryTransfer(transferId)

src/routes/api/public/
  stark-webhook.ts                    → recebe eventos, valida, persiste, HTTP 200
  hooks/process-payout-queue.ts       → worker cron (a cada 1 min) drena fila
  hooks/reconcile-charges.ts          → cron (a cada 15 min) consulta Stark p/ pagamentos não notificados
```

Regras:
- Webhook nunca envia PIX. Só persiste `stark_events` + enfileira job.
- Antes de liberar repasse, `PayoutService` reconsulta `PixRequest.get(id)` para confirmar `success`.
- Idempotência via `external_id` (usar `installment_id` / `transfer_id`).
- Retry com backoff exponencial (max 5 tentativas) no worker.

## 3. Fluxo end-to-end

```
Inquilino paga QR/Boleto Stark
        ↓
Webhook Stark → /api/public/stark-webhook
   • valida assinatura ECDSA (starkbank-ecdsa)
   • grava stark_events (raw)
   • marca installment = 'pago' + paid_amount + paid_at
   • cria linhas em payment_transfers (nexo/agency/owner) status=PENDING
   • responde 200
        ↓
Cron process-payout-queue (1 min)
   • pega PENDING → PROCESSING
   • confirma pagamento consultando Stark
   • SplitEngine calcula (já foi feito, valida)
   • PayoutService envia PixRequest p/ cada beneficiário
   • grava stark_transfer_id, status=COMPLETED/FAILED
        ↓
Cron reconcile (15 min) — safety net p/ webhooks perdidos
```

## 4. SplitEngine

Entrada: `paid_amount`, `nexo_flat_fee` (platform_settings), `management_fee_percent` (property), chaves PIX de agency + owner.

Saída:
```
{
  nexo:   { amount: nexoFee,    pixKey: MASTER_KEY (fica na conta) },
  agency: { amount: managerCut, pixKey: agency.pix_key },
  owner:  { amount: net,        pixKey: profile.pix_key },
}
```
Regra: `net = paid - nexoFee - managerCut`. Se `net <= 0` → owner=0, agency recebe resto. Zero PIX nativo.

## 5. Banco de dados (migração)

Novas tabelas:
- `payment_transfers` — id, installment_id, contract_id, recipient_type (`nexo|agency|owner`), recipient_user_id, pix_key, amount, status (`PENDING|PROCESSING|COMPLETED|FAILED`), stark_transfer_id, error_message, attempts, next_retry_at, created_at, updated_at, paid_at. RLS: manager/owner/landlord da própria linha lê; writes só service_role.
- `stark_charges` — id, installment_id UNIQUE, kind (`pix|boleto|pix_boleto`), stark_id, txid, brcode, qrcode_png (base64 ou URL), boleto_line, boleto_barcode, boleto_pdf_url, amount, due_date, status (`created|paid|expired|canceled`), created_at, updated_at, paid_at.
- `stark_events` — id, event_id UNIQUE (idempotência), subscription, log_type, raw jsonb, processed_at, error.

Alterações em `installments`: adicionar `stark_charge_id` (fk), manter colunas de status.

DROP: tabela `efi_payouts`, colunas `efi_account_number` em `asaas_accounts` e `agency_settings`.

GRANT + RLS + policies obrigatórios em cada nova tabela.

## 6. Secrets

Adicionar via `add_secret`:
- `STARK_PROJECT_ID`
- `STARK_PRIVATE_KEY` (PEM EC secp256k1)
- `STARK_ENVIRONMENT` (`sandbox` | `production`)
- `STARK_WEBHOOK_SECRET` (usado p/ validar signature header)

Remover (delete_secret): `ASAAS_*`, `NEXO_MASTER_WALLET_ID`.

## 7. UI

- `OwnerPixKeyPanel` — mantém, só troca copy p/ "PIX Stark".
- `PixSplitConfigPanel` — mantém chave imobiliária.
- `PixPaymentDialog` — troca payload p/ nova função `generateStarkPix(installmentId)`, mesmo polling.
- Remover: `AsaasBankAndKycPanel`, `PainelRepasses`, rotas `/admin.configuracoes.subconta` e integrações Asaas.
- Novo painel `admin` `Repasses` mostrando `payment_transfers` com botão "Reprocessar" (chama `retryTransfer`).

## 8. Cron

Registrar via `supabase--insert` (pg_cron + pg_net) chamando as duas rotas com header `apikey: <anon>`. Sem `CRON_SECRET` novo — usar anon key, seguindo padrão.

## 9. Detalhes técnicos Stark (docs oficiais mais recentes)

- REST v2: `https://api.starkbank.com/v2` (prod) / `https://sandbox.api.starkbank.com/v2` (sandbox).
- Auth: header `Access-Id: project/<id>`, `Access-Time: <unix>`, `Access-Signature: base64(ECDSA(secp256k1, sha256(accessId:accessTime:body)))`.
- Cobrança PIX dinâmica: `POST /dynamic-brcode` (amount, expiration, tags, externalId). Retorna `uuid`, `id`, `brcode`, `picture` (QR PNG endpoint).
- Boleto: `POST /boleto` (name, taxId, streetLine1/2, district, city, stateCode, zipCode, due, amount, tags). Retorna `line`, `barCode`, `pdf` URL.
- PIX outbound: `POST /pix-request` com `pixKey` do recebedor (ou dados bancários), `externalId`, `amount` centavos, `description`.
- Webhook: `POST /webhook` p/ criar subscription (`brcode-payment`, `pix-request`, `boleto`). Handler valida `Digital-Signature` com `starkbank-ecdsa` + chave pública da Stark (buscada em `/public-key`).

Implementação HTTP nativa (fetch), sem SDK — evita deps Node-only no Worker. Assinatura ECDSA via `starkbank-ecdsa` (pura JS, compatível Workers).

## 10. Entrega em ordem

1. Migração DB (novas tabelas + drops)
2. Solicitar secrets Stark
3. `stark.server.ts` (cliente assinado) + `split-engine.ts`
4. `charges.server.ts` + serverFn + refactor `PixPaymentDialog`
5. `webhook.server.ts` + rota pública + registrar subscription
6. `payouts.server.ts` + `transfers.repo` + worker cron + reconcile cron
7. Remoção Efí + Asaas (arquivos, rotas, painéis, secrets)
8. Painel admin de Repasses + retry
9. Reescrever `.lovable/plan.md`

## Pontos que preciso confirmar antes de começar

1. **Remover também o Asaas?** Ele ainda é o motor ativo de cobrança/subconta/KYC. Se mantido, teremos dois provedores conflitando. Recomendo remover tudo Asaas junto (proposta acima). Confirma?
2. **Chave PIX Nexo (recebedora)**: continua a mesma cadastrada em `platform_settings.nexo_platform_pix_key` (CNPJ 66524872000167) e ela será a chave da conta Stark, correto?
3. **Boleto**: geração automática D-15 (como estava na Efí) ou só sob demanda?
