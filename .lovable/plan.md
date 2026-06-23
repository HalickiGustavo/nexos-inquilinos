## Objetivo

Reestruturar a tela **Migrar Dados** (`src/routes/_manager/manager.migrar-dados.tsx`) para deixar de usar uma única planilha "tudo-em-um" e passar a aceitar **3 planilhas CSV separadas**, uma para cada entidade do domínio imobiliário:

1. **Proprietários** (`proprietarios.csv`)
2. **Imóveis** (`imoveis.csv`) — referencia o proprietário pelo CPF/CNPJ
3. **Contratos / Inquilinos** (`contratos.csv`) — referencia o imóvel por um código interno e cria o inquilino junto

Hoje o arquivo único mistura 8 colunas de 4 entidades e gera confusão (ex.: "qual CPF é do proprietário?", "e se o mesmo proprietário tem 10 imóveis?"). A separação resolve isso e ainda permite importar em etapas (primeiro a base de proprietários, depois imóveis, depois contratos).

## Nova estrutura das planilhas

### 1. `proprietarios.csv`
```
proprietario_cpf_cnpj,proprietario_nome,proprietario_email,proprietario_telefone
123.456.789-09,Maria Souza,maria@exemplo.com,(11) 98888-7777
```
- Chave única: `proprietario_cpf_cnpj` (deduplicação no upsert).
- `email` e `telefone` opcionais.

### 2. `imoveis.csv`
```
imovel_codigo,proprietario_cpf_cnpj,imovel_endereco,imovel_tipo,imovel_valor_aluguel,imovel_status
IM-001,123.456.789-09,Rua das Flores 123 - Centro,apartamento,1500.00,disponivel
```
- `imovel_codigo`: identificador interno do cliente (livre, ex.: "AP-302"); usado depois pelo CSV de contratos.
- `proprietario_cpf_cnpj`: liga o imóvel a um proprietário já importado.
- `imovel_status`: `disponivel` | `alugado` | `manutencao` (default `disponivel`).

### 3. `contratos.csv`
```
imovel_codigo,inquilino_cpf,inquilino_nome,inquilino_email,inquilino_telefone,contrato_valor,contrato_vencimento,contrato_duracao_meses,contrato_ativo
IM-001,987.654.321-00,João Pereira,joao@exemplo.com,(11) 97777-6666,1500.00,2026-07-10,12,sim
```
- `imovel_codigo`: precisa existir (importado no passo 2 **ou** já cadastrado na conta).
- Cria/atualiza o inquilino por CPF e gera o contrato + parcelas (trigger atual cuida das parcelas).

## Mudanças no UI da página

Layout em **3 cards de upload empilhados**, cada um com:
- Ícone próprio (Users / Home / FileText) e cor do tema (violet/fuchsia/cyan).
- Botão "Baixar modelo" individual (gera o CSV daquele passo).
- Dropzone próprio com contador de linhas válidas.
- Selo de status: `Pendente` → `Pronto` → `Importado ✓` (com contagem de sucessos/erros).

Abaixo dos três cards, um único botão **"Iniciar importação completa"** que:
1. Processa `proprietarios` (upsert por CPF/CNPJ).
2. Processa `imoveis` (resolve `proprietario_cpf_cnpj` → `owner_id`/`owner_name`; deduplica por `imovel_codigo` salvo em `properties.code` ou `notes`).
3. Processa `contratos` (resolve `imovel_codigo` → `property_id`; upsert do inquilino por CPF; insere contrato).

Cada etapa só roda se a planilha correspondente estiver carregada **ou** se a etapa anterior puder satisfazer as referências sozinha (ex.: posso importar só `contratos.csv` se os imóveis já existem na conta).

Painel de progresso atualizado mostra 3 barras (uma por entidade) em vez de uma só, mais a lista consolidada de erros com a coluna "Origem" (`proprietarios` / `imoveis` / `contratos`).

## Mudanças técnicas (resumo para revisão)

- Refatorar `MigrarDadosPage` para manter 3 estados independentes (`rowsOwners`, `rowsProps`, `rowsContracts`) em vez de um único `rows`.
- Extrair as funções de parse/validação para um util local `migracao-helpers.ts` (mesma pasta) — `parseBRDate`, `parseMoney`, `parseBool`, `onlyDigits`, validação de headers por entidade.
- 3 funções `downloadTemplateOwners()`, `downloadTemplateProperties()`, `downloadTemplateContracts()` com headers e linhas-exemplo próprias.
- `processImport()` vira um pipeline sequencial com 3 etapas; cada etapa devolve `{ ok, errors }` e alimenta um único array consolidado de erros com `origem`.
- Aproveitar `properties.code` (já existe, gerado por trigger) como chave de ligação — quando o usuário fornece `imovel_codigo`, sobrescrevemos o valor padrão; quando não fornece, geramos um automático e exibimos no relatório final para ele anotar.
- Nenhuma mudança de schema no Supabase; nenhuma alteração em rotas/sidebar.

## Fora do escopo

- Importação de XLSX (continua só CSV).
- Importação de fotos/anexos de imóveis.
- Re-design da sidebar / outras telas.
- Mudanças no fluxo de criação manual de proprietário/imóvel/contrato.

## Pergunta antes de executar

Confirma esse formato de 3 planilhas separadas, ou prefere 2 planilhas (juntando `imoveis` + `contratos`, já que normalmente vêm juntos do sistema antigo)?
