# Planejamento: Monitoramento, Saúde e Otimização de Performance

Este plano detalha a implementação de melhorias estruturais focadas em detecção automática de problemas e escalabilidade do sistema Nexo, conforme solicitado.

## 1. Monitoramento e Saúde (Health Check)

O objetivo é integrar a aplicação principal com a API de saúde já existente, garantindo visibilidade sobre o estado do sistema sem criar novas interfaces.

### Ações Técnicas
- **Integração com API de Saúde**: Consumir os endpoints em `src/routes/api/public/crm/health.ts` (ou equivalentes existentes) para monitoramento externo.
- **Middleware de Erros Global**: Implementar um `requestMiddleware` e `functionMiddleware` no TanStack Start (`src/start.ts`) para interceptar exceções críticas e enviá-las para o log de saúde/monitoramento.
- **Health Checks Leves**: Adicionar verificações rápidas de conectividade para:
  - Supabase (Ping rápido via `.select('1').limit(1)`)
  - Efí API (Verificação de status do token)
  - Evolution API (Status da conexão da instância)
- **Correlação de Requisições**: Inserir `x-correlation-id` nos headers de todas as chamadas de API e server functions para facilitar o rastreamento no monitoramento externo.
- **Idempotência de Alertas**: Implementar lógica de debounce/janela de tempo no envio de erros repetitivos para evitar "alert fatigue".

## 2. Otimização de Performance e Escalabilidade

Reorganização das telas e fluxos de dados para suportar grandes volumes de informações (milhares de registros).

### Ações Técnicas
- **Paginação Server-Side**:
  - Migrar listagens (Imóveis, Contratos, Inquilinos, Financeiro) de carregamento total para paginação baseada em `limit` e `offset` via Supabase.
  - Atualizar componentes de tabela para gerenciar o estado da página e disparar novas buscas.
- **Busca e Filtragem Eficiente**:
  - Garantir que filtros de texto e status ocorram na query do banco de dados, não no frontend.
  - Implementar debouncing nas buscas globais.
- **Otimização de Consultas (N+1)**:
  - Substituir loops de consulta por Joins ou consultas agregadas.
  - Utilizar `.select('*, properties(*), tenants(*)')` para carregar relações necessárias em uma única viagem ao servidor.
- **Lazy Loading e Suspense**:
  - Aplicar `React.Suspense` e `Skeleton loaders` em componentes pesados (Gráficos, Listas financeiras).
  - Utilizar carregamento sob demanda para documentos e imagens pesadas.
- **Estratégias de Cache**:
  - Configurar `staleTime` e `cacheTime` adequados no TanStack Query para dados de referência.
  - Garantir invalidação precisa de cache após mutações.

## 3. Segurança e Integridade

- **Políticas RLS**: Revisar e reforçar o isolamento multi-tenant.
- **Sanitização de Dados**: Garantir que segredos (senhas, chaves de API, PII) nunca sejam enviados nos payloads de monitoramento.

## Critérios de Sucesso
- Health Check operacional e acessível via API protegida.
- Carregamento inicial de telas críticas (Dashboard, Financeiro) reduzido significativamente.
- Listas carregando apenas o necessário via paginação.
- Nenhum dado sensível exposto em logs ou monitoramento.
