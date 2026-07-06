
# Otimização da Área do Proprietário (Owner) — NEXO

Escopo: **apenas UI/UX + organização de dados**. Não altero banco, RLS, endpoints, regras financeiras, integrações Stark/Supabase, autenticação nem regras de negócio. Tema Dark Premium preservado (roxo + preto, bordas suaves, sombras discretas).

Rotas afetadas (todas sob `src/routes/_authenticated/`): `dashboard`, `conta-corrente`, `properties`, `contracts`, `tenants`, `financials`, `maintenances`, `vistorias`, `documentos`, `relatorios`, `_authenticated.tsx` (sidebar).

---

## Estratégia geral

- **Reuso** de queries existentes (`useProperties`, `useContracts`, `useInstallments`, `useMaintenances`, etc.) — sem novos endpoints.
- Toda métrica derivada é **calculada no cliente** a partir dos dados já carregados (memoized com `useMemo`).
- Novos componentes ficam em `src/components/owner/` para não poluir o global.
- Tokens do design system: `bg-card`, `border`, `text-muted-foreground`, `text-primary`, `text-emerald-500`, `text-amber-500`, `text-destructive` — nada de cores hardcoded.
- Padrão responsivo: grid mobile-first (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), tabelas viram cards em `<sm`, `min-w-0`/`truncate`/`shrink-0` em headers.

---

## Fase 1 — Dashboard executivo (`dashboard.tsx`)

**Objetivo:** carteira compreendida em <10s.

1. **Card "Minha Carteira"** (topo, span total):
   - Total de imóveis / Alugados / Disponíveis / Contratos ativos / Receita prevista mês / Recebida / Pendente / Inadimplência / Manutenções abertas / Documentos pendentes.
   - Layout: grid 2×5 desktop, 2×5 tablet, stack mobile — cada célula com ícone + label + valor tabular.

2. **KPIs financeiros expandidos** (linha secundária de 4+4 cards):
   - Receita prevista, recebida, pendente, líquida.
   - Retido em manutenção, taxa admin paga, ticket médio mensal, receita acumulada YTD.

3. **Card "Insights da Carteira"** — gerador determinístico no cliente:
   - Regras: 100% recebido no mês → verde; imóvel vago >30d → âmbar; variação MoM %; manutenção `orcado`/`aguardando_aprovacao` → âmbar; contrato com `end_date` <30d → âmbar; se nenhuma → "Nenhuma pendência encontrada".
   - Máx 4 insights, ordenados por severidade.

4. **Painel "Aprovações Pendentes"** acionável:
   - Lista manutenções `budget_status='orcado'`.
   - Cada linha: título, imóvel, valor, botões `Aprovar agora` / `Ver orçamento` (reusa `MaintenanceBudgetPanel` em Dialog — nenhuma nova mutation).

5. **Gráficos**:
   - Altura reduzida (`h-56` → `h-48`).
   - Toggle de período: 6m / 12m / Ano atual / Comparativo anual.
   - Gráfico secundário: **Previsto × Recebido** (bar duplo).
   - Gráfico de **ocupação** (% ocupado ao longo do tempo — derivado de `contracts.start_date/end_date`).

---

## Fase 2 — Conta Corrente virou extrato (`conta-corrente.tsx`)

Hoje é resumo por imóvel. Vira **extrato cronológico** com resumo em cima.

1. **Cards de resumo do período**: Receita bruta / Taxas / Manutenções / Receita líquida / Saldo recebido / Saldo acumulado YTD.
2. **Timeline cronológica**:
   - Fonte: `installments` pagas (entrada PIX/boleto), derivação de taxa admin por parcela, `maintenances` aprovadas (saída), repasse líquido (calculado).
   - Cada linha: data, tipo (ícone + cor), descrição, imóvel, valor com sinal, badge de método (PIX/Boleto).
3. **Filtros**: chips (Todos / Receitas / Taxas / Manutenções / Repasses / PIX / Boleto) + busca por imóvel/descrição + navegação de mês existente.
4. **Exportação**: botões PDF (jsPDF já no bundle via `pdf.ts`), CSV (client-side), Excel (`xlsx` — verificar se está instalado; se não, apenas CSV+PDF nesta fase e sugerir Excel para fase futura).
5. **Receita acumulada por imóvel** ao final (tabela colapsável — mantém a atual como seção).

---

## Fase 3 — Imóveis: cards ricos + página individual (`properties.tsx` + nova rota)

### 3a. Cards da listagem (reformulados)
Cada card mostra: nickname, endereço, badge status, aluguel, condomínio, IPTU, tipo, **inquilino atual**, **status do contrato**, **último pagamento**, **próximo vencimento**, **receita acumulada do imóvel**, **receita do ano**, **tempo ocupado / disponível**, indicadores de pagamento (🟢🟡🔴), ocupação anual %, receita histórica.

- **Menu de ações rápidas** (DropdownMenu): Ver imóvel / Contrato / Financeiro / Conta Corrente / Documentos / Vistorias / Manutenções / Histórico / Editar / Excluir.
- **Micro-indicadores** no rodapé do card: última manutenção, última vistoria, último doc, última cobrança (só o mais recente de cada, se existir).
- **Ordenação** (Select): Receita, Nome, Data, Maior aluguel, Menor aluguel, Status.
- **Filtros** (Tabs): Todos / Alugados / Disponíveis / Em manutenção / Em atraso.

### 3b. Nova rota `/properties/$id` (página individual, não modal)

Arquivo: `src/routes/_authenticated/properties.$id.tsx`. Layout com tabs (shadcn `Tabs`):

- **Resumo** — foto (usa `property_photos`), endereço, código, valor, receita anual, receita total, status, tempo ocupado, rentabilidade (rent × 12 / valor_referência se disponível, ou vs custo mensal).
- **Financeiro** — comparativo mensal/anual, prevista × realizada, líquida, retido.
- **Contrato** — dias restantes, data de reajuste, índice, status, valor atual, histórico.
- **Inquilino** — dados do tenant do contrato ativo.
- **Documentos** — lista filtrada por `property_id`.
- **Vistorias** — lista filtrada + próxima prevista.
- **Manutenções** — abertas / concluídas / gasto total / médio / tempo médio de resolução.
- **Histórico** — timeline de eventos (contratos, pagamentos, manutenções, vistorias, docs).

Todas as tabs reusam queries existentes com `.filter(x.property_id === id)`.

---

## Fase 4 — Sidebar (ordem)

`_authenticated.tsx` — reordenar `navGroups.items` para:
Visão Geral, Conta Corrente, Imóveis, Contratos, Inquilinos, Manutenções, Vistorias, Documentos, Relatórios.
(Remove "Finanças" da barra principal — vira sub-aba dentro da nova página do imóvel + dashboard cobre o global. **Decisão:** mantenho `/financials` acessível, mas movo pra depois de Relatórios como "Finanças (detalhado)" pra não perder a rota. Se preferir remover totalmente do menu, me diga.)

---

## Fase 5 — Padrões UX transversais

- Skeletons unificados (`SkeletonCard`, `SkeletonRow`) em todas as telas do owner.
- Empty states com ícone + CTA (não só texto cinza).
- Altura de cards padronizada em cada grid (`h-full` no wrapper).
- Tipografia: `text-2xl font-bold tracking-tight` H1, `text-sm text-muted-foreground` subtítulos, `tabular-nums` em todos os valores monetários.
- Foco visível (`focus-visible:ring-2 ring-ring`), `aria-label` em botões-ícone, ordem de tabulação lógica.
- Contrastes revisados (WCAG AA no dark).

---

## Fase 6 — Responsividade + performance

- Tabelas de `financials`, `relatorios`, `conta-corrente` viram cards em `<sm` (padrão `hidden sm:table-cell` / stack em cima).
- Header do dashboard usa `grid-cols-[minmax(0,1fr)_auto]` conforme guideline.
- `React.memo` nos cards de imóvel (evita re-render ao trocar filtro).
- Lazy-load da página individual (`properties.$id.tsx` já code-split via file-routing).
- Verificar bundle: se `xlsx` não estiver, uso apenas CSV/PDF na exportação.

---

## Detalhes técnicos (rápido)

- Não crio novos server-fns nem migrations.
- Novos arquivos previstos:
  - `src/components/owner/PortfolioSummary.tsx`
  - `src/components/owner/PortfolioInsights.tsx`
  - `src/components/owner/PendingApprovalsPanel.tsx`
  - `src/components/owner/OccupancyChart.tsx`
  - `src/components/owner/ForecastVsReceivedChart.tsx`
  - `src/components/owner/StatementTimeline.tsx`
  - `src/components/owner/PropertyCard.tsx`
  - `src/routes/_authenticated/properties.$id.tsx` + subcomponentes de aba
  - `src/lib/owner-insights.ts` (regras determinísticas)
  - `src/lib/owner-export.ts` (CSV/PDF do extrato)
- Todos os cálculos usam apenas campos existentes em `installments`, `contracts`, `properties`, `maintenances`, `variable_expenses`, `documents`, `inspections`.

---

## Como sugiro executar

Cada fase é um PR mental separado. Recomendo esta ordem (do maior ROI pro menor):

1. **Fase 1 (Dashboard)** — impacto imediato, isolado.
2. **Fase 3a (cards de imóveis)** + **Fase 4 (sidebar)** juntos — mesma tela.
3. **Fase 2 (Conta Corrente extrato)**.
4. **Fase 3b (página individual do imóvel)** — a maior, entrego sozinha.
5. **Fase 5 + 6 (padrões e responsividade)** — passada final.

Ao término de cada fase, gero um mini-relatório: implementado / pendente / sugestões que exigem backend.

**Confirma que quero rodar tudo em sequência sem parar (executo fase por fase entregando cada uma), ou prefere que eu ataque só a Fase 1 primeiro pra você validar o estilo antes das demais?**
