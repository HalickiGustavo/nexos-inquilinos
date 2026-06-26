## Objetivo

Adicionar uma camada de **Pix com split nativo de 3 vias** (Nexo / Imobiliária / Proprietário) usando a Efí Pay como PSP, **sem subcontas e sem KYC**. O Asaas atual continua intacto como fallback para contratos já criados.

Como ainda não temos credenciais da Efí, a engine é entregue em **modo mock**: gera QR Code real (payload BR Code v01 válido, com CRC16 correto) apontando para a chave Pix da Nexo, mas a divisão é **registrada na tabela `pix_splits`** para reconciliação. Quando as credenciais forem fornecidas, basta trocar o adapter `efi.server.ts` por chamadas HTTP reais (estrutura já preparada).

## Banco de dados (migração)

1. `agency_settings`: adicionar `agency_pix_key text`, `agency_pix_key_type text` (CPF/CNPJ/EMAIL/PHONE/EVP).
2. `properties` (já guarda landlord): adicionar `owner_pix_key text`, `owner_pix_key_type text`.
3. `contracts`: adicionar `agency_admin_fee_percentage numeric(5,2) default 10`.
4. `platform_settings`: garantir `nexo_platform_pix_key text`, `nexo_flat_fee numeric(10,2) default 24.99`.
5. Nova tabela `pix_splits` (registro do split por parcela):

```
id, installment_id (fk), provider text ('efi'|'mock'),
nexo_amount, agency_amount, owner_amount,
nexo_pix_key, agency_pix_key, owner_pix_key,
psp_txid text, psp_qrcode_base64 text, psp_pix_payload text,
status text ('pending'|'paid'|'failed'), created_at, updated_at
```

Com GRANTs e RLS escopados via `installments.user_id`.

## Backend

- `src/lib/efi.server.ts` — adapter isolado (`createCharge`, `createSplitCharge`). Sem credenciais: monta BR Code Pix válido localmente (payload EMV + CRC16 ITU) e retorna QR PNG via lib `qrcode`. Com credenciais (futuro): chama `/v2/cob` + `/v2/loc/{id}/qrcode` da Efí.
- `src/lib/pix-split.functions.ts` — `generateTripleSplitPix({ installmentId })` com `requireSupabaseAuth`:
  1. Carrega installment → contract → property → landlord → agency_settings → platform_settings.
  2. Calcula fatias: `nexo = nexo_flat_fee`; `agency = rent * fee% / 100`; `owner = rent - nexo - agency`. Valida `owner >= 0`.
  3. Resolve as 3 chaves Pix (erro descritivo se faltar).
  4. Chama `efi.createSplitCharge(...)` com `infoAdicional: "Aluguel Mensal - Processado por NEXO"`.
  5. Upsert em `pix_splits`, retorna `{ qrCodeBase64, copiaECola, breakdown }`.
- Adicionar dep `qrcode` (`bun add qrcode`).

## Frontend

- `src/components/PixPaymentDialog.tsx`: trocar a fonte do PIX. Quando o contrato tiver as 3 chaves Pix configuradas, chama `generateTripleSplitPix`; caso contrário, mantém `ensureTenantPixCharge` (Asaas).
- Novo bloco "Detalhamento do split" (collapsible, dark + neon roxo) mostrando as 3 fatias.
- Toast verde esmeralda: "Código Pix copiado! Cole no aplicativo do seu banco para pagar."
- Painéis de cadastro:
  - `manager.proprietarios.tsx`: campo "Chave Pix do proprietário" + tipo.
  - `_authenticated/integrations.tsx` (aba Imobiliária): "Chave Pix da imobiliária" + tipo.
  - `admin.integracoes.tsx`: "Chave Pix da plataforma Nexo" + `nexo_flat_fee`.

## Modo Mock x Produção

`EFI_CLIENT_ID` ausente → engine roda mock (QR aponta para chave Nexo, splits ficam em `pix_splits` para repasse manual D+1 via cron já existente). Quando você adicionar `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERTIFICATE_BASE64`, `EFI_PIX_KEY` via `add_secret`, o adapter automaticamente passa a chamar a API real com split nativo.

## Entregas desta rodada

1. Migração (tabelas + colunas + RLS + GRANT).
2. `efi.server.ts` (mock + estrutura pronta).
3. `pix-split.functions.ts` (engine).
4. UI: PixPaymentDialog com split breakdown + cadastros das 3 chaves.
5. Documento curto em `.lovable/plan.md` explicando como ativar a Efí real.