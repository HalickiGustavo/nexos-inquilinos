## Objetivo

Trocar o gateway de pagamento da NEXO: sair do **Asaas** (subcontas + KYC) e ir para a **Efí Pay**, mantendo todas as funcionalidades de cobrança, sem exigir KYC do proprietário nem da imobiliária.

Dois fluxos cobertos:

1. **Pix com split nativo (zero KYC)** — A Efí divide o valor na liquidação entre 3 chaves Pix: Nexo, Imobiliária e Proprietário. Proprietário/Imobiliária só precisam informar a chave Pix.
2. **Boleto (Opção A)** — Boleto emitido pela Efí cai 100% na conta Efí da Nexo. Webhook `charge.paid` dispara, em D+1, transferências Pix automáticas para a Imobiliária e Proprietário (mesmas chaves já cadastradas). Sem subcontas.

Adapter Efí já existe em modo mock (`src/lib/efi.server.ts`). Esta rodada pluga a API real, adiciona Boleto, webhook e payout automatizado, e remove o Asaas do caminho crítico.

> Os secrets da Efí (`EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERTIFICATE_BASE64`, `EFI_PIX_KEY`, `EFI_WEBHOOK_HMAC`) **não** serão pedidos agora — o usuário ainda vai criar a conta na Efí. Enquanto faltam, o sistema roda em modo mock (Pix com QR válido apontando para a chave Nexo, Boleto desabilitado com aviso).

## Mudanças de banco (1 migração)

1. `pix_splits`: adicionar coluna `charge_type text default 'pix'` (`pix`|`boleto`), `boleto_url text`, `boleto_barcode text`, `paid_at timestamptz`, `payout_status text default 'pending'` (`pending`|`scheduled`|`paid`|`failed`), `payout_scheduled_for date`, `payout_error text`.
2. Nova tabela `efi_payouts` (transferências Pix individuais para imobiliária/proprietário após boleto pago):
   - `id, pix_split_id (fk), recipient text ('agency'|'owner'), pix_key, pix_key_type, amount, e2e_id, status, error, created_at, paid_at`.
3. `installments`: adicionar `boleto_url text`, `boleto_barcode text`, `charge_provider text default 'efi'`.
4. GRANTs + RLS escopado por `installments.user_id` / `pix_splits.user_id`.

## Backend

### `src/lib/efi.server.ts` (expandir adapter)

- `isProductionMode()` continua olhando `EFI_CLIENT_ID`.
- `createPixSplitCharge(input)` — em produção: `POST /v2/cob/{txid}` com `split` nativo, depois `GET /v2/loc/{id}/qrcode` para QR; em mock mantém o BR Code atual.
- `createBoletoCharge(input)` — `POST /v1/charge` (boleto Efí), retorna `barcode`, `pdf.charge`, `link`. Em mock retorna erro amigável: "Boleto exige credenciais Efí. Use Pix por enquanto."
- `sendPix(input)` — `POST /v3/gn/pix/{idEnvio}` para repasses D+1. Em mock: registra como `mock_sent`.
- `verifyWebhookSignature(rawBody, signature)` — HMAC SHA-256 contra `EFI_WEBHOOK_HMAC`.
- Autenticação Efí: OAuth client_credentials com certificado P12 (carregado de `EFI_CERTIFICATE_BASE64`) — helper `efiFetch(path, opts)` cacheia o token por 50 min.

### `src/lib/pix-split.functions.ts` (ampliar)

- `generateTripleSplitPix({ installmentId })` — já existe; passa a chamar `createPixSplitCharge` (split nativo) quando produção.
- **NOVO** `generateBoletoCharge({ installmentId })` — calcula mesmas 3 fatias, cria boleto na conta Efí da Nexo, grava `pix_splits` com `charge_type='boleto'`, atualiza `installments.boleto_url/boleto_barcode`. Retorna `{ url, barcode }`.

### `src/routes/api/public/efi-webhook.ts` (NOVO)

- `POST /api/public/efi-webhook` — recebe notificações Efí (Pix + Boleto).
- Verifica HMAC (`verifyWebhookSignature`), valida payload Zod.
- Eventos relevantes:
  - `pix` recebido (split nativo): marca `pix_splits.status='paid'`, `installments.status='pago'`.
  - `charge.paid` (boleto): marca `pix_splits.status='paid'`, `installments.status='pago'`, agenda `payout_status='scheduled'`, `payout_scheduled_for=now+1d`.
- Idempotente por `psp_txid`/`e2e_id`.

### `src/lib/efi-payouts.functions.ts` (NOVO, server-only)

- `runProcessEfiBoletoPayouts()` — busca `pix_splits` com `charge_type='boleto'`, `status='paid'`, `payout_status='scheduled'`, `payout_scheduled_for<=today`. Para cada:
  - Cria 2 `efi_payouts` (agency, owner) com valores das fatias.
  - Chama `sendPix` para cada um (chaves já gravadas em `pix_splits.agency_pix_key`/`owner_pix_key`).
  - Atualiza `payout_status='paid'` quando ambos confirmam (ou `failed` + `payout_error`).

### `src/routes/api/public/hooks/process-efi-payouts.ts` (NOVO)

- Cron diário (autenticado por `apikey: SUPABASE_ANON_KEY`) que invoca `runProcessEfiBoletoPayouts()`.
- SQL `pg_cron` será publicado via `supabase--insert` no fim.

## Frontend

### `src/components/PixPaymentDialog.tsx`

- Adicionar tabs **Pix** / **Boleto**. Pix = `generateTripleSplitPix`. Boleto = `generateBoletoCharge` (botão "Gerar boleto", baixa PDF, copia linha digitável).
- Mensagem clara em modo mock para boleto: "Disponível assim que as credenciais da Efí forem cadastradas."

### Aposentar Asaas no fluxo principal

- `PainelRepasses.tsx` — substituir leitura de `asaas_accounts/kyc_status` por status simples baseado em `pix_splits` recentes; remover bloco "KYC pendente".
- `manager.integracao.tsx` / `AsaasBankAndKycPanel.tsx` — esconder seção Asaas atrás de um accordion "Legado (Asaas)" colapsado por padrão. **Não apagar tabelas/código** — apenas tirar do caminho do usuário, para preservar contratos antigos.
- `PixSplitConfigPanel.tsx` — promovê-lo a card principal da aba Integrações: "Configurar suas chaves Pix (sem KYC)" com os 3 campos (Nexo no admin, Imobiliária na agência, Proprietário no cadastro do imóvel — já existem).
- Toda referência a `ensureTenantPixCharge` (Asaas) deixa de ser fallback: passa a usar Efí mock se faltarem credenciais.

### `manager.financeiro.tsx` e `tenant.financeiro.tsx`

- Coluna "Boleto" com link PDF quando `installments.boleto_url` existir.

## Modo Mock x Produção

- Sem `EFI_CLIENT_ID`: Pix mock (QR válido para chave Nexo configurada em `platform_settings`), boleto desabilitado com tooltip explicativo, payout marca `mock_sent` sem chamar API.
- Com credenciais: tudo flui real, split nativo na liquidação, webhook ativo, payout D+1 ativo.

## Entregas desta rodada

1. Migração SQL (3 alterações + 1 nova tabela + GRANT/RLS).
2. `efi.server.ts` expandido (OAuth, split nativo, boleto, sendPix, HMAC).
3. `pix-split.functions.ts` com `generateBoletoCharge`.
4. `efi-payouts.functions.ts` + route `api/public/hooks/process-efi-payouts`.
5. `api/public/efi-webhook.ts`.
6. UI: `PixPaymentDialog` com tabs Pix/Boleto, Asaas movido para "Legado", `PixSplitConfigPanel` em destaque.
7. Atualização do `.lovable/plan.md` com instruções de ativação.
8. Quando o usuário avisar que criou a conta Efí, peço os secrets via `add_secret`.

## Riscos / pontos de atenção

- **Boleto sem credenciais** fica desabilitado — comunico isso na UI.
- **Asaas legado** continua funcionando para contratos antigos; nada é deletado. Webhook Asaas permanece ativo para liquidações pendentes.
- Cron de repasse antigo (`process-landlord-payouts`, baseado em Asaas) é mantido até zerar inadimplências antigas; o novo (`process-efi-payouts`) opera só sobre boletos Efí.