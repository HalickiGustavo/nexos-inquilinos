## Objetivo

Permitir emitir boletos com vencimento original respeitando a regra do Asaas (não aceita data passada), **sem perder juros e multa** do atraso. A solução calcula juros/multa proporcional aos dias vencidos, soma ao valor do boleto e emite com vencimento de hoje. As taxas são configuráveis por contrato.

## Mudanças

### 1. Banco de dados
Adicionar dois campos em `contracts`:
- `late_fee_percent` (numeric, default 2.00) — multa única em %
- `daily_interest_percent` (numeric, default 0.033) — juros ao dia em % (0,033%/dia ≈ 1% ao mês)

Migration via tool de migração.

### 2. Formulário de contrato (`src/routes/_authenticated/contracts.tsx`)
- Adicionar dois inputs no formulário de criação/edição: **Multa por atraso (%)** e **Juros ao dia (%)**, com os defaults acima preenchidos.
- Mostrar os valores na listagem/detalhe do contrato.

### 3. Geração do boleto (`src/lib/asaas.functions.ts` — `generateAsaasCharge`)
- Carregar `late_fee_percent` e `daily_interest_percent` do contrato junto com a parcela.
- Calcular dias de atraso = `today - due_date` (se > 0).
- `multa = baseValue * late_fee_percent / 100`
- `juros = baseValue * daily_interest_percent / 100 * diasAtraso`
- `valorTotal = baseValue + multa + juros + taxa NEXO`
- `dueDate` enviado ao Asaas: `today` se vencido, senão data original.
- Descrição do boleto detalha: valor base, multa, juros (X dias), taxa NEXO e o vencimento original.
- Persistir `extra_fees = multa + juros` (ou campo dedicado, ver "Decisão técnica") para refletir no financeiro local.

### 4. Atualização de boleto existente (`updateAsaasChargeFee`)
- Mesma lógica: se a parcela já vencida ainda está pendente, recalcular juros/multa atuais e enviar `PUT /payments/:id` com novo `value` e `dueDate` ajustado.

### 5. UI Financeiro
- No card/linha da parcela vencida, exibir prévia do "Valor com juros hoje" antes de gerar o boleto, para o owner ter visibilidade.

## Decisão técnica

- **Campo `extra_fees` vs novo campo**: hoje `extra_fees` é editável manualmente pelo owner. Para evitar conflito, vou usar um novo campo `late_charges` (numeric, default 0) em `installments` para guardar multa+juros calculados automaticamente. `extra_fees` continua para ajustes manuais. Soma final = `amount + extra_fees + late_charges`.
- **Recalcular ao pagar**: o webhook do Asaas atualiza `paid_amount` com o que o inquilino pagou. Não recalculamos juros após emissão — o valor do boleto já está fechado.
- **Casos sem atraso**: lógica antiga preservada, `dueDate` = data original, sem juros/multa.

## Diagrama do fluxo

```text
Owner clica "Gerar boleto" em parcela vencida
   │
   ▼
Carrega parcela + contract.late_fee_percent + daily_interest_percent
   │
   ▼
diasAtraso = today - due_date
multa  = base * 2%          (configurável)
juros  = base * 0,033% * dias (configurável)
   │
   ▼
POST /payments Asaas:
  value    = base + multa + juros + taxa NEXO
  dueDate  = today
  desc.    = "venc. original DD/MM (X dias de atraso: multa R$X + juros R$Y)"
   │
   ▼
installments.late_charges = multa + juros
installments.boleto_url   = <url>
```

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — adiciona colunas em `contracts` e `installments`
- `src/lib/asaas.functions.ts` — cálculo de juros/multa em `generateAsaasCharge` e `updateAsaasChargeFee`
- `src/routes/_authenticated/contracts.tsx` — campos no form
- `src/routes/_authenticated/financials.tsx` — prévia do valor com juros