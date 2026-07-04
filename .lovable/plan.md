## Objetivo
Transformar `/manager` (dashboard da imobiliária) em um centro de controle denso, rápido e produtivo, no estilo Linear/Stripe/Attio, mantendo identidade NEXO (preto + roxo) e todas as regras de negócio.

## Escopo desta entrega
Foco principal na **Dashboard do Manager** (`src/routes/_manager/manager.index.tsx`) + **Sidebar** (`src/routes/_manager.tsx`) + **Cabeçalho superior com busca global**. Padronização visual dos outros módulos fica como fase 2 (evita PR gigante e risco de regressão).

## 1. Sidebar reorganizada (`_manager.tsx`)
Agrupar itens com títulos discretos:
- **Dashboard**: Dashboard
- **Gestão**: Carteira, Financeiro, DIMOB
- **Pessoas**: Proprietários, Inquilinos, Equipe
- **Operação**: Vistorias, Manutenções
- **Comercial**: Leads, Roleta de Leads, Portais
- **Sistema**: Migrar Dados, Perfil

Melhorias: espaçamento, indicador ativo mais elegante (barra lateral roxa + bg sutil), ícones consistentes 16px, hover suave.

## 2. Cabeçalho superior (novo)
Barra fixa no topo do conteúdo com:
- Pesquisa global (`⌘K` / `Ctrl+K`) — Command component do shadcn, busca em contratos, imóveis, proprietários, inquilinos, leads, com debounce e RPC/queries paralelas
- Seletor de período global (persistido em contexto)
- Sino de notificações (já existe `AlertsBell`, reposicionar)
- Avatar + menu do usuário

## 3. Dashboard reconstruída

### Hero compacto (~50% menor)
Saudação personalizada + resumo textual dinâmico:
> Bom dia, {nome} 👋  
> {X} contratos ativos · {Y} cobranças pendentes · {Z} manutenções abertas · {W} contratos vencendo esta semana

Sem gradiente gigante; faixa fina com identidade roxa.

### KPIs financeiros (6 cards)
Recebido hoje · A receber · Receita do mês · Em atraso · Taxa NEXO · Repasses pendentes. Cada card: label, valor tabular, delta vs mês anterior (seta + %).

### Grid principal (2 colunas em desktop)
**Coluna esquerda (maior):**
- Gráfico financeiro (Recebimentos/Pagamentos/Repasses/Receita) com toggle Hoje/7d/30d/90d/Ano — Recharts (já usado)
- Próximos vencimentos (contratos + cobranças) com destaque para atrasos
- Atividades recentes (timeline)

**Coluna direita (menor):**
- Pendências prioritárias (boletos vencidos, PIX pendentes, contratos aguardando assinatura, vistorias pendentes, leads sem atendimento, chamados abertos)
- Atalhos rápidos (grid de ícones grandes com hover + tooltip)
- Indicadores operacionais compactos (contratos ativos, imóveis, alugados, proprietários, inquilinos, leads)

### Padrões
- Card unificado: título, valor, descrição, ícone, skeleton, empty state textual
- Loading: Skeleton em vez de `animate-pulse` avulso
- Empty: "Nenhum contrato ativo encontrado" em vez de "0"
- Hierarquia: Financeiro → Pendências → Contratos → Atividade

## 4. Performance & UX
- Queries paralelas com `useQueries` para reduzir cascata
- Debounce na pesquisa global
- Lazy load do gráfico e das listas longas
- Realtime channel único (mantém padrão atual)
- Microinterações via `transition-colors`/`hover-lift` já existentes — sem novas libs

## Fora deste PR (fase 2, se aprovado)
- Padronização visual das outras rotas do manager (Carteira, Financeiro, Proprietários, Inquilinos, Vistorias)
- Auditoria completa de espaçamento/tipografia global
- Relatório final de UX

## Detalhes técnicos
- Reuso de `useQuery` + `supabase` (padrão do projeto), sem novas dependências
- Command palette com `@/components/ui/command` (já instalado)
- Contexto de período em `src/lib/dashboard-context.tsx` (novo, leve)
- Sem alterar schema, RLS, integrações Asaas/Stark, permissões

## Confirmações antes de codar
1. Fase 1 = Dashboard + Sidebar + Header/Busca. Fase 2 = padronização dos outros módulos. OK?
2. Pesquisa global: buscar em contratos/imóveis/proprietários/inquilinos/leads já cobre — adicionar mais alguma entidade?
3. Manter as 3 opções de período (Este mês / 3 meses / Ano) OU trocar pelas do prompt (Hoje/7d/30d/90d/Ano)?
