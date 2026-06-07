
# NEXO Manager — Portal da Imobiliária

Novo portal paralelo ao painel do Owner e ao do Inquilino, voltado para imobiliárias gerenciando carteira grande, equipe e CRM. Compartilha o mesmo banco (Lovable Cloud).

## 1. Banco de dados (migração única)

Novo role `manager` no enum `app_role` + tabelas:

- `manager_members` — equipe da imobiliária
  - `manager_user_id` (dono da imobiliária — auth.uid), `member_user_id` (nullable, preenchido após aceite do convite), `name`, `email`, `role_label` (corretor/admin/financeiro), `invite_token`, `status` (pendente/ativo/inativo)
- `properties` — adicionar `manager_id` (nullable), `owner_name`, `owner_commission_percent` (default 10), `assigned_member_id`, `neighborhood`, `code` (gerado)
- `installments` — adicionar `management_fee_percent` (default 10), `payout_status` (pendente/aguardando/repassado), `payout_date`
- `crm_leads` — `manager_user_id`, `name`, `phone`, `email`, `budget`, `interested_property_id` (nullable), `interested_code` (texto livre), `stage` (novos/contato/proposta/fechado), `notes`
- `crm_lead_notes` — histórico de notas por lead

Triggers `set_updated_at` + RLS por `manager_user_id = auth.uid()` (e leitura para membros via subquery em `manager_members`). GRANTs para `authenticated` e `service_role`.

`handle_new_user` permanece criando `owner`. Manager se torna manager por uma rota de onboarding `/manager-setup` que insere `manager` em `user_roles`.

## 2. Roteamento e shell

- Novo layout `src/routes/_manager/route.tsx` (gate igual ao `_authenticated`, mas exige role `manager`).
- Sidebar shadcn (`src/components/ManagerSidebar.tsx`) com: Dashboard, Carteira, Financeiro, Equipe, CRM.
- Tema corporativo: paleta zinc/slate com accent emerald. Tokens em `src/styles.css` sob seletor `.theme-manager` aplicado no shell.
- Rotas:
  - `_manager/index.tsx` → Dashboard
  - `_manager/carteira.tsx`
  - `_manager/financeiro.tsx`
  - `_manager/equipe.tsx`
  - `_manager/crm.tsx`

Login: detectar role `manager` em `useUserRole` e redirecionar para `/manager`. Adicionar botão "Sou Imobiliária" no login que vai para `/manager-setup`.

## 3. Módulos

### A. Dashboard
4 KPI cards: VGV sob gestão (sum `rent_price * 12` dos imóveis), Receita do mês (sum `paid_amount` installments do mês), Taxa de vacância (% imóveis disponíveis), Leads ativos (count crm_leads stage ≠ fechado). Gráfico Recharts BarChart "Previsto vs Recebido" últimos 6 meses.

### B. Carteira
Tabela shadcn de `properties` com join em contrato ativo + inquilino. Colunas: Código, Tipo, Endereço, Proprietário, Inquilino/Disponível, Aluguel. Filtros: status select, busca por cidade/bairro. Ações: Ver detalhes (dialog), Editar contrato (link `/manager/...`), Adicionar imóvel (dialog reaproveitando lógica de properties).

### C. Financeiro
Tabs shadcn:
- **Recebimentos**: lista global de installments com filtros por status e data, badges de status, link para boleto.
- **Repasses**: agrupado por proprietário/imóvel, calcula `paid_amount - (paid_amount * management_fee_percent/100)`, status "Aguardando" vs "Repassado", botão "Confirmar repasse" que atualiza `payout_status` + `payout_date`.

### D. Equipe
Tabela de `manager_members` com Nome, Email, Função, Contratos ativos sob responsabilidade (count `contracts` via `assigned_member_id`). Dialog "Convidar novo membro" cria registro com `invite_token` e exibe link `/manager-invite?token=...` (envio de email fica como TODO simples — toast com o link).

### E. CRM
Kanban com 4 colunas (`novos`, `contato`, `proposta`, `fechado`) usando `@dnd-kit` (já comum). Cards mostram nome, budget BRL, código do imóvel, telefone. Drag-and-drop atualiza `stage`. Dialog para criar/editar lead + adicionar notas (lista de `crm_lead_notes`).

## 4. Bibliotecas

Adicionar `@dnd-kit/core` e `@dnd-kit/sortable` para o Kanban.

## 5. Formatação

Reutilizar `formatBRL` e `formatDate` de `src/lib/format.ts` em todas as tabelas.

## Observações

- Não mexer no fluxo existente de Owner/Tenant.
- Realtime: subscribe nas tabelas `installments` e `crm_leads` no Dashboard para refletir mutações ao vivo.
- Tudo em PT-BR.

Confirma para eu seguir com a migração e implementação?
