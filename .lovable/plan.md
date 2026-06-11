# Plano de Auditoria em 3 Fases

Cada fase entregue separadamente. Você valida (testa as telas críticas) antes da próxima.

---

## Fase 1 — Segurança (entrega primeiro)

**Objetivo:** fechar buracos sem mexer em UI nem em queries.

1. **Route guards reforçados**
   - Garantir que `_authenticated/route.tsx` e `_manager.tsx` redirecionam para `/login` quando `session === null` (não apenas `user`), evitando flash de conteúdo durante refresh.
   - Adicionar verificação de role no `_manager` antes de montar — hoje já existe mas roda depois do render inicial; mover para `beforeLoad`-equivalente client-side.

2. **Limpeza de `console.log` sensíveis**
   - Varrer `src/` por `console.log/info/debug` que imprimam `session`, `user`, `error` cru de Supabase, tokens ou payloads do Asaas.
   - Manter apenas `console.error` em catch blocks, sanitizando para não vazar email/CPF/tokens.

3. **Sanitização de inputs**
   - Validar com Zod nos formulários que ainda gravam direto: CRM leads, manutenções (mensagens), notas internas. Limites de tamanho + `.trim()`.
   - Conferir `dangerouslySetInnerHTML` (não deve existir; confirmar).

4. **Storage**
   - Auditar `localStorage`/`sessionStorage` fora do Supabase auth client. Remover qualquer gravação de dados de contrato/inquilino/CPF.

5. **RLS lint**
   - Rodar `supabase--linter` e corrigir findings críticos (tabelas sem RLS, policies abertas).

**Entrega:** relatório curto com itens corrigidos + arquivos tocados.

---

## Fase 2 — Performance

**Objetivo:** acelerar carga inicial e reduzir re-renders. Sem mudar comportamento.

1. **Lazy loading de telas pesadas**
   - `manager.migrar-dados` (papaparse), `manager.dimob` (gerador de TXT), `manager.financeiro` (charts), `manager.index` (recharts).
   - Como TanStack Start já faz auto code-splitting de `component`, o ganho real vem de: (a) garantir que componentes não são `export`ados, (b) mover libs pesadas (papaparse, pdf-lib) para imports dinâmicos dentro de handlers, não no topo do módulo.

2. **Queries Supabase**
   - Trocar `select('*')` por colunas específicas em:
     - `useProperties` / `useTenants` / `useContracts` / `useInstallments` em `src/lib/queries.ts`
     - `manager.crm.tsx`, `manager.equipe.tsx`, `tenant.financeiro.tsx`
   - Adicionar `.limit()` razoável + ordenação server-side onde a tela já pagina visualmente.
   - Aumentar `staleTime` no QueryClient global de 30s para 60s nas listas que mudam pouco (properties, tenants).

3. **React.memo / useMemo / useCallback**
   - Memoizar linhas das tabelas grandes (`manager.financeiro` parcelas agrupadas, `contracts`, `properties`).
   - `useMemo` em agregações (somas de aluguel, totais do dashboard) que hoje recalculam a cada render.

4. **CLS**
   - Reservar `min-h` nos cards do dashboard que carregam dados assíncronos para evitar pulo de layout.

**Entrega:** relatório com tela → técnica aplicada + medição visual (antes vs depois quando relevante).

---

## Fase 3 — Cleanup

1. Remover imports não usados (eslint --fix onde seguro).
2. Apagar utilitários duplicados em `src/lib/` se houver.
3. Padronizar formatação BRL/data via `src/lib/format.ts` em telas que ainda usam `toLocaleString` inline.
4. Conferir que nenhum arquivo `*.functions.ts` importa `client.server` no topo (regra crítica do template).

**Entrega:** diff resumo + lista de arquivos removidos/consolidados.

---

## Como vou trabalhar

- Início imediato pela **Fase 1** assim que aprovar este plano.
- Ao final de cada fase: paro, mostro o relatório, espero seu OK antes da próxima.
- Design (fundo preto, neon roxo) intocado em todas as fases.
- Nada de mudanças no schema do banco sem te avisar.

## Detalhes técnicos

- Stack: TanStack Start + Supabase (Lovable Cloud) + React Query + Tailwind v4.
- Auto code-splitting já ativo via Vite plugin — refactor de lazy foca em **dynamic imports** dentro de handlers/effects, não em `React.lazy` manual.
- RLS check via tool `supabase--linter`.
- Sem alterações em `routeTree.gen.ts`, `client.ts`, `auth-middleware.ts`, `types.ts` (auto-gerados).
