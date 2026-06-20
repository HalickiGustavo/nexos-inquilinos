# Fluxo de Mensagens WhatsApp para Inquilinos

Aproveita o `whatsapp.functions.ts` que já existe e os secrets `EVOLUTION_API_URL`, `EVOLUTION_API_INSTANCE`, `EVOLUTION_API_KEY` já cadastrados. A instância do Evolution está inativa no momento — o sistema vai logar a falha e seguir, sem quebrar nada. Quando reativarem, os disparos passam a sair automaticamente.

## 1. Mensagem de boas-vindas (completar cadastro)

Já existe `sendWelcomeWhatsApp` enviado no cadastro de inquilino. Vou:

- Reescrever o texto para focar em **completar o cadastro** (link de ativação + senha), não só "boas-vindas".
- Garantir que é chamado no momento certo (após criar tenant + enviar magic link / invite).
- Reenvio manual: botão "Reenviar WhatsApp" na tela de detalhes do inquilino, caso a primeira tentativa falhe (instância offline agora).

## 2. Lembretes de cobrança automáticos

Régua sobre a tabela `installments`:

| Gatilho | Quando | Tom |
|---|---|---|
| pre-10 | 10 dias antes do vencimento | aviso leve |
| pre-5  | 5 dias antes | lembrete |
| pre-2  | 2 dias antes | reforço |
| pre-1  | 1 dia antes | última chance amigável |
| post-1 | 1 dia após vencimento | cobrança cordial + link de pagamento |
| post-2 | 2 dias após | cobrança |
| post-3 | 3 dias após | cobrança firme |
| post-5 | 5 dias após | aviso de juros/multa |
| post-7 | 7 dias após | aviso de encaminhamento |

Cada parcela recebe no máximo **uma mensagem por estágio** (controle por tabela de log, sem duplicar).

## 3. Detalhes técnicos

**Migration** — nova tabela `installment_notifications`:
- `installment_id` (fk), `stage` (text: `pre-10`, `pre-5`, ..., `post-7`), `sent_at`, `status` (`sent`/`failed`/`skipped`), `error` (text), `channel` (`whatsapp`).
- Unique (`installment_id`, `stage`, `channel`) — impede duplicidade.
- RLS: manager/owner do contrato lê; writes só via service_role.

**Server route público de cron** — `src/routes/api/public/hooks/send-tenant-reminders.ts`:
- Autenticado via header `apikey` (anon key — padrão Lovable).
- Lê parcelas com status `pendente`/`atrasado` cujo `due_date` cai num dos 9 offsets.
- Para cada parcela elegível sem log do estágio, monta a mensagem (nome do inquilino, valor BRL, vencimento, link Asaas se houver), chama Evolution API e grava o log (`sent` ou `failed` + mensagem do erro).
- Falha em uma parcela não interrompe as outras.

**pg_cron** — agenda o hook 1x ao dia (ex.: 09:00 BRT = 12:00 UTC) via `supabase--insert`.

**Helper compartilhado** — `src/lib/whatsapp.server.ts` com `sendEvolutionText({ phone, text })`, usado tanto pelo cron quanto pelo `sendWelcomeWhatsApp` (refator pequeno, sem mudar contrato).

**Templates** — `src/lib/whatsapp-templates.ts`: uma função por estágio, recebe `{ nome, valor, vencimento, linkPagamento? }` e devolve string. Centralizado pra editar copy depois.

**UI** — na tela do inquilino (owner e manager), pequena seção "Notificações enviadas" listando os logs (estágio + data + status). Permite ao gestor saber o que já saiu.

## 4. Comportamento com instância offline

- Toda chamada à Evolution já tem try/catch e retorna `{ ok: false, reason }`.
- O cron grava `status: 'failed'` com o motivo — assim, quando a instância voltar, o gestor vê o histórico e pode disparar reenvio manual pelos botões da UI.
- **Sem reenvio automático de mensagens antigas**: quando a instância voltar, parcelas que já passaram do estágio ficam marcadas como `failed` no log — a régua só dispara o próximo estágio futuro. Isso evita avalanche de mensagens atrasadas.

## 5. O que NÃO faço nesta entrega

- Não mexo no design existente.
- Não crio novos secrets (uso os 3 do Evolution já cadastrados).
- Não toco em Asaas / cobranças em si — só leio `link_pagamento` da parcela se existir.
- Sem opt-out por inquilino agora (posso adicionar depois se pedir).

## Arquivos a criar/editar

- `supabase/migrations/<timestamp>_installment_notifications.sql` (nova tabela + RLS + grants)
- `src/lib/whatsapp.server.ts` (helper de envio)
- `src/lib/whatsapp-templates.ts` (9 templates de cobrança + 1 boas-vindas)
- `src/lib/whatsapp.functions.ts` (refator + nova fn `resendWelcomeWhatsApp`)
- `src/routes/api/public/hooks/send-tenant-reminders.ts` (cron handler)
- `src/routes/_authenticated/tenants.tsx` e `_manager/manager.carteira.tsx` (botão reenviar + histórico)
- pg_cron schedule via `supabase--insert` (após deploy)

Aprova pra eu começar?
