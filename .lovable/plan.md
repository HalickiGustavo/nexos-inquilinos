# Ativação da Efí Pay (NEXO)

Este projeto roda **100% sobre Efí Pay** para Pix e Boleto. Asaas ficou no
banco como legado (não removido) apenas para liquidações antigas.

## Fluxos ativos

1. **Pix split nativo (zero KYC)** — `generateTripleSplitPix` cria uma
   cobrança Efí (`PUT /v2/cob/{txid}`) com `split.divisao` apontando para as
   chaves Pix da Imobiliária e do Proprietário. Liquidação direta nas 3
   contas.
2. **Boleto Opção A** — `generateBoletoCharge` emite boleto na conta Efí da
   Nexo. Quando o webhook `/api/public/efi-webhook` recebe `charge.paid`, o
   split é marcado como `payout_status='scheduled'` para D+1. O cron
   `/api/public/hooks/process-efi-payouts` chama `sendPix` para Imobiliária
   e Proprietário, registrando cada transferência em `efi_payouts`.

## Modo Mock (atual — sem credenciais)

Sem `EFI_CLIENT_ID`:
- **Pix**: gera BR Code estático válido com CRC16, apontando para a chave
  Pix Nexo configurada em `platform_settings.nexo_platform_pix_key`. O
  split fica registrado em `pix_splits` para conciliação manual.
- **Boleto**: botão "Gerar boleto" retorna erro amigável avisando que
  precisa das credenciais.
- **sendPix** (repasse): grava `efi_payouts.status='mock_sent'` sem chamar
  API externa.

## Para ativar produção

1. Criar conta na Efí Pay (https://www.efipay.com.br).
2. Gerar **certificado P12** (homologação + produção) no painel da Efí.
3. Cadastrar a **chave Pix da Nexo** na conta Efí.
4. Configurar **webhook** apontando para
   `https://nexos-inquilinos.lovable.app/api/public/efi-webhook` no painel
   Efí (Pix + Boleto), e definir um segredo HMAC.
5. Pedir ao agente para salvar os secrets:
   - `EFI_CLIENT_ID`
   - `EFI_CLIENT_SECRET`
   - `EFI_CERTIFICATE_BASE64` (base64 do arquivo .p12)
   - `EFI_CERTIFICATE_PASSPHRASE` (opcional, se o .p12 tiver senha)
   - `EFI_PIX_KEY` (chave Pix Nexo registrada na Efí)
   - `EFI_WEBHOOK_HMAC` (segredo definido no painel)
   - `EFI_ENV` (`sandbox` ou `production`)

A partir daí, `isEfiProductionMode()` retorna `true` e todo o sistema passa
a chamar a API real automaticamente.

## Cron de repasse D+1

Após cadastrar os secrets, agendar via `pg_cron` (necessário rodar SQL com
`supabase--insert`):

```sql
select cron.schedule(
  'efi-process-payouts-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://nexos-inquilinos.lovable.app/api/public/hooks/process-efi-payouts',
    headers := jsonb_build_object('Content-Type','application/json','apikey', '<SUPABASE_ANON_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
```

## Tabelas

- `pix_splits` — split por parcela (Pix ou Boleto), com status de repasse.
- `efi_payouts` — uma linha por transferência Pix de repasse (agency, owner).
- `installments.boleto_url / boleto_barcode / charge_provider` — referência
  do boleto Efí na parcela.
