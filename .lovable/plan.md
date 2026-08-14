# Plano de Atualização de Texto - NEXO 2.0

O objetivo deste plano é atualizar os textos de marketing e descrição da plataforma para refletir a maturidade do produto, substituindo referências a "protótipos" ou linguagens datadas por uma comunicação de sistema em produção de alta performance.

## Alterações Propostas

### 1. Atualização da Tela de Login
Substituir a descrição genérica por uma que ressalte a modernidade e eficiência da plataforma.

- **Arquivo:** `src/routes/login.tsx`
- **Texto Antigo:** "Inquilinos, contratos, parcelas e manutenções em uma única plataforma moderna e segura."
- **Texto Novo:** "Interface mais bonita e fácil: a tela atual cumpre a função, mas tem aparência datada. Uma versão 2.0 mais moderna e intuitiva torna o uso diário agradável e ajuda a conquistar e reter clientes."

### 2. Refinamento dos Dashboards (Proprietário e Imobiliária)
Garantir que os cabeçalhos e descrições de KPI reflitam a natureza dinâmica e em tempo real dos dados, removendo qualquer resquício de placeholders.

- **Arquivos:** 
    - `src/routes/_authenticated/dashboard.tsx` (Proprietário)
    - `src/routes/_manager/manager.index.tsx` (Imobiliária)
    - `src/routes/_landlord/landlord.index.tsx` (Landlord Autônomo)

## Detalhes Técnicos

- Utilização de `code--line_replace` para substituição precisa das strings.
- Manutenção da estrutura de acessibilidade (ARIA) e responsividade.
- Verificação via build para garantir que nenhuma interpolação de string foi quebrada.
