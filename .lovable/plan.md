## Visão geral

Adicionar uma experiência completa para o papel **Inquilino** (NEXO Tenant) na mesma aplicação, mantendo o painel atual para **Proprietário** (Owner). A UI muda 100% conforme o papel detectado no login, com RLS estrita no backend para que cada inquilino veja apenas os próprios dados.

## 1. Backend (migração Supabase)

Mudanças de schema em uma única migração:

- **Enum `app_role`**: `'owner' | 'tenant'`.
- **Tabela `user_roles`** (id, user_id → auth.users, role) + função `has_role(uuid, app_role)` SECURITY DEFINER.
- **`tenants.user_id_link`** (uuid, FK lógica para auth.users, nullable): liga uma conta de login a um registro de inquilino. Usada para detectar "qual tenant é esse usuário".
- **`maintenances.tenant_id`** (uuid, nullable): permite vincular um chamado a um inquilino que o abriu.
- **Nova tabela `maintenance_messages`** para o chat por chamado:
  - `id`, `maintenance_id`, `sender_user_id`, `content`, `created_at`.
  - RLS: usuário vê/insere mensagens apenas onde participa (dono do imóvel OU inquilino vinculado).
  - Adicionada ao `supabase_realtime` publication.
- **Atualização do trigger `handle_new_user`**: ao criar profile, atribui role `owner` por padrão (proprietários criam a conta sozinhos; inquilinos são convidados pelo dono — fluxo de convite fica como próxima iteração; por ora, é possível promover manualmente um usuário a `tenant` via `user_roles` e ligar via `tenants.user_id_link`).
- **Políticas RLS adicionais (tenant-side)** em tabelas existentes, usando `EXISTS (SELECT 1 FROM tenants WHERE tenants.id = <table>.tenant_id AND tenants.user_id_link = auth.uid())`:
  - `contracts`: SELECT para o inquilino do contrato.
  - `installments`: SELECT para o inquilino do contrato pai.
  - `maintenances`: SELECT/INSERT/UPDATE limitado ao próprio chamado do inquilino.
  - `properties`: SELECT do imóvel referenciado em contrato ativo do inquilino.
- **GRANTs** explícitos em todas as tabelas novas/afetadas.

## 2. Detecção de papel e roteamento

- Novo hook `useUserRole()` que consulta `user_roles` para o `auth.uid()` atual.
- No `_authenticated.tsx`: enquanto carrega o papel → spinner. Depois:
  - `owner` → layout atual (sidebar com Imóveis, Inquilinos, Contratos, etc.).
  - `tenant` → novo layout `TenantShell` (mobile-first, bottom-nav).
- Rotas novas sob `src/routes/_authenticated/tenant/`:
  - `tenant/index.tsx` — Início
  - `tenant/financeiro.tsx` — Boletos & Finanças
  - `tenant/contrato.tsx` — Meu Contrato
  - `tenant/manutencoes.tsx` — Solicitações + Chat
- Owner acessando `/tenant/*` é redirecionado para `/dashboard` e vice-versa.

## 3. Telas do Portal Inquilino

### Início (`/tenant`)
- Saudação personalizada.
- Card destaque "Próximo Aluguel": valor, vencimento, status (pago/pendente/atrasado), CTA **Copiar Chave Pix** e **Ver Boleto**.
- Pedido de permissão de notificação nativa (`Notification.requestPermission()`) ao montar; dispara notificação local quando há fatura nova/atrasada (verificação no client a cada load).
- Mini-cards: chamados em aberto, próximo vencimento, status do contrato.

### Boletos & Finanças (`/tenant/financeiro`)
- Lista todas as `installments` do contrato ativo, ordem decrescente.
- Badges coloridos: Pago (verde), Pendente (amarelo), Atrasado (vermelho — calculado se `due_date < hoje` e status pendente).
- Expandir parcela pendente: chave Pix simulada + botão copiar; código de barras mock.
- Parcela paga: botão "Baixar Recibo (PDF)" que gera PDF client-side simples com jsPDF.

### Meu Contrato (`/tenant/contrato`)
- Detalhes do contrato ativo: período, valor, índice de reajuste, dia de vencimento, depósito.
- Barra de progresso (meses decorridos / total).
- Botão "Baixar Contrato (PDF)" — gera PDF mock com os termos.

### Manutenções + Chat (`/tenant/manutencoes`)
- Layout split desktop / abas mobile.
- **Esquerda**: lista de chamados do inquilino, badge de status, botão "Nova Solicitação" abre dialog (Título, Descrição, Categoria).
- **Direita**: ao selecionar chamado, abre chat com mensagens em `maintenance_messages` via Supabase Realtime. Bolhas: inquilino à direita (primary), proprietário à esquerda (muted), timestamps, input com Enter para enviar.
- Owner também ganha acesso ao mesmo chat dentro da página existente `maintenances.tsx` (drawer lateral) para responder.

## 4. Design

- Tema NEXO mantido (tokens em `src/styles.css`).
- Shell do inquilino: header compacto com logo + avatar, bottom-nav fixa em mobile (Início, Financeiro, Contrato, Manutenções), sidebar no desktop.
- Componentes shadcn: Card, Badge, Progress, Dialog, Tabs, ScrollArea.
- Animações suaves com tailwind (`transition`, `animate-in`).

## 5. Detalhes técnicos

- Novas queries em `src/lib/queries.ts`: `useTenantContract`, `useTenantInstallments`, `useTenantMaintenances`, `useMaintenanceMessages(id)`, `useSendMaintenanceMessage`.
- Hook `useRealtimeMessages(maintenanceId)` que assina canal `messages:<id>`.
- `jspdf` adicionado como dependência para gerar recibos/contrato mock.
- Toda copy em PT-BR.

## 6. Ordem de execução

1. Migração SQL (roles, link tenant↔user, tabela de mensagens, RLS, realtime).
2. Hook `useUserRole` + bifurcação de layout em `_authenticated.tsx`.
3. Rotas e telas do inquilino (Início, Financeiro, Contrato).
4. Manutenções + chat realtime (lado inquilino e drawer no lado owner).
5. Polimento visual mobile-first e notificações nativas.

## Pendências para confirmar

- **Como inquilinos viram inquilinos?** Por ora vou deixar a vinculação manual (owner edita o registro de `tenants` e cola o `user_id` do inquilino já cadastrado, role atribuída via SQL). Fluxo de **convite por email** com link mágico é a evolução natural — posso implementar em seguida se quiser.
- PDFs serão mocks visuais (jsPDF). Geração real a partir de template fica para depois.