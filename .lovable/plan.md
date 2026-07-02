# Validação E2E — Stark Bank Sandbox

Objetivo: rodar os 15 fluxos solicitados contra o sandbox real, corrigindo qualquer inconsistência antes de prosseguir, e entregar relatório final com sinal verde para produção.

Trabalho grande (12–15 chamadas Stark reais, ~5–8 migrations potenciais, ajustes de código). Confirme antes que eu comece.

---

## Fase 0 — Pré-requisitos (bloqueantes)

1. Confirmar credenciais sandbox atuais (`STARK_ENVIRONMENT=sandbox`, `STARK_PROJECT_ID`, `STARK_PRIVATE_KEY`) com permissão **admin** na workspace (a antiga só tinha "financeiro" e falhou em `/webhook`).
2. Confirmar chave PIX de teste válida no DICT sandbox da Stark (a chave `13824591901` não resolve em sandbox — precisa de uma chave gerada dentro da sandbox Stark para simular proprietário/imobiliária).
3. Verificar `nexo_platform_pix_key` em `platform_settings` e `nexo_flat_fee`.

Sem (1) e (2) os fluxos 1, 2, 7 e 13 não conseguem completar `/transfer`.

---

## Fase 1 — Auditoria estática (sem tocar em nada ainda)

Ler e conferir contra docs oficiais Stark (starkbank.com/docs/api, versão atual):

- `stark.server.ts` — assinatura ECDSA, header `Digital-Signature`, endpoints `/invoice`, `/boleto`, `/transfer`, `/dict-key`, `/webhook`.
- `charges.server.ts` — payload de Invoice (PIX dinâmico) e Boleto conforme spec atual.
- `payouts.server.ts` — `/dict-key` + `/transfer` (fluxo já correto vs. Split nativo).
- `webhook.server.ts` — subscriptions `invoice`, `boleto`, `transfer`; idempotência via `stark_events.event_id`.
- `worker.server.ts` — claim/backoff/retry, reconciliação PROCESSING.
- `split-engine.ts` — soma bate ao centavo (invariante Fluxo 14).
- Crons em `pg_cron` (process-payouts 1min, reconcile 15min, generate-upcoming-boletos).

Reportar toda divergência com a doc oficial e corrigir antes de testar.

## Fase 2 — Fluxo 14 (invariante financeiro) — testes unitários

Rodar `split-engine` com 30+ cenários (arredondamento, taxa > valor, sem agency, sem owner, valor 0, centavos ímpares) e garantir `nexo+agency+owner === paidAmount` sempre.

## Fase 3 — Fluxo 1 (Proprietário autônomo) — E2E sandbox

1. Criar contrato de teste + parcela.
2. `generateTripleSplitPix` → validar Invoice na Stark (`GET /invoice/{id}`), QR + copia-cola.
3. Simular pagamento via `POST /invoice/{id}/log` sandbox.
4. Aguardar webhook → conferir `stark_events`, `stark_charges.status=paid`, `installments.status=pago`, 2 rows em `payment_transfers` (nexo, owner).
5. Aguardar cron (ou disparar `/api/public/hooks/process-payout-queue` manualmente) → conferir `/transfer` criado, webhook `transfer.success`, `payment_transfers.status=COMPLETED`.

## Fase 4 — Fluxo 2 (Imobiliária) — split 3 vias

Mesmo que Fase 3 mas com `agency_settings.pix_key` preenchida → validar 3 transfers e conferência ao centavo.

## Fase 5 — Fluxo 3 (PIX edge cases) + Fluxo 6 (Webhook)

- Assinatura inválida → 401
- Payload sem `event.id` → 400
- Evento duplicado (mesmo `event_id`) → 200 idempotente, sem duplicar transfers
- Evento fora de ordem (`transfer.success` antes de `invoice.paid`) → tratado
- PIX expirado / cancelado

## Fase 6 — Fluxo 4 + 5 (Boletos e Scheduler)

Confirmar cron `generate-upcoming-boletos`: cria boleto exatamente D-15, idempotente por `external_id`, atualiza se `due_date` mudar. Rodar manualmente e conferir DB.

## Fase 7 — Fluxo 7 (Transferências, erros)

- Chave inexistente → FAILED com mensagem, retry até 5x com backoff `attempts²`.
- Timeout `starkFetch` → retry.
- Saldo insuficiente sandbox (se simulável) → FAILED.

## Fase 8 — Fluxo 8 (Banco) + Fluxo 9 (Dashboard) + Fluxo 10 (Notificações)

- Verificar FKs, constraints, absence of duplicates via queries.
- Abrir dashboards (proprietário, manager, admin) via preview + Playwright, confirmar atualização sem reload.
- Conferir `installment_notifications` disparadas.

## Fase 9 — Fluxo 11 (Segurança) + Fluxo 12 (Logs)

- `rg` no `src/` por `STARK_` para garantir nenhum uso no client bundle.
- Conferir logs estruturados em cada etapa (webhook, worker, retry).

## Fase 10 — Fluxo 13 (Stress)

Script Node disparando 50 e 100 invoices sandbox em paralelo + simulação de pagamentos → conferir:
- `stark_events` sem perda
- `payment_transfers` sem duplicidade (unique constraint em `external_id`)
- worker drena tudo em N ciclos

## Fase 11 — Fluxo 15 (Extremos)

Sem PIX owner, sem PIX agency, contrato encerrado, boleto vencido, múltiplos contratos por proprietário.

## Fase 12 — Relatório final

Documento em `.lovable/stark-e2e-report.md` com: funcionalidades testadas, bugs encontrados/corrigidos, evidências (IDs Stark, rows DB), cobertura, pendências, GO/NO-GO para produção.

---

## Detalhes técnicos

- Testes E2E: script Python usando `starkFetch` via endpoint interno de debug (ou `curl` direto assinado) — sandbox Stark aceita `POST /invoice/{id}/log` com `{"log": {"type": "credited"}}` para simular pagamento.
- Stress: `asyncio.gather` disparando via server route interno de teste (protegido por header admin, só disponível quando `STARK_ENVIRONMENT=sandbox`).
- Correções: cada bug → migration (schema) ou edit + reteste antes de avançar.

## Riscos / limitações sandbox

- DICT sandbox só resolve chaves geradas dentro da própria sandbox — proprietários reais precisam trocar temporariamente.
- Alguns cenários (saldo insuficiente, timeout) podem não ser reproduzíveis fielmente — serão documentados como "coberto via mock unitário".
- Este trabalho consome créditos AI significativos (12–20 turnos com muitas chamadas HTTP).

## Confirmação necessária

Responda:
1. Podemos prosseguir com toda a validação E2E (~15–20 turnos)?
2. A workspace sandbox atual tem permissão admin agora ou preciso trabalhar com o que existe?
3. Você já tem uma chave PIX de teste da sandbox Stark disponível, ou eu gero uma via API no início?
