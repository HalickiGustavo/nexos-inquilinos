# Estudo: Assinatura Eletrônica de Contratos no NEXO

> Pesquisa apenas — nada será implementado sem sua aprovação explícita.

## Contexto atual
Hoje o módulo `ContractPdfUploader` permite anexar o PDF do contrato, mas **não há fluxo de assinatura**. Inquilino e locador precisam imprimir, assinar e reenviar — fricção alta para um app moderno.

## Três caminhos possíveis

### Caminho A — Assinador GOV.BR (oficial, gratuito)
A Plataforma de Assinatura GOV.BR usa a conta gov.br do cidadão (CPF + selo prata/ouro) e gera assinatura avançada com validade jurídica equivalente à manuscrita (MP 2.200-2/2001 + Lei 14.063/2020).

Duas formas de usar:

**A1. API oficial (`assinatura-api.staging.iti.br` / produção)**
- Fluxo OAuth2 + POST do PDF → assinante autentica no gov.br → API devolve PDF assinado (PAdES).
- **Bloqueio crítico:** as credenciais só são liberadas a **órgãos públicos** ("Gestor Público" precisa abrir solicitação no Serviço de Integração ID). Empresa privada não consegue habilitar.
- Veredito: **inviável para o NEXO como integração direta.**

**A2. Redirect para `assinador.iti.br`**
- Usuário baixa o PDF gerado pelo NEXO, abre `https://assinador.iti.br`, faz upload, assina com gov.br, devolve no NEXO via upload.
- Zero custo, validade plena, mas **3 cliques manuais** e nenhuma rastreabilidade automática (precisamos confiar no upload final).
- Veredito: **viável como opção gratuita/fallback**, não como fluxo principal.

### Caminho B — API de terceiro (recomendado)
Plataformas brasileiras com API REST, webhooks e fluxo embutido por e-mail/WhatsApp. Validade jurídica equivalente (assinatura eletrônica avançada, com trilha de auditoria, IP, geolocalização, hash do documento). Suportam também ICP-Brasil (qualificada) quando o signatário tem certificado A1/A3.

Comparativo das principais opções (preços públicos, 2026):

| Plataforma     | Preço entrada                | API/Webhooks | WhatsApp nativo | Diferencial |
|----------------|-------------------------------|--------------|-----------------|-------------|
| **ZapSign**    | R$ 49/mês (50 docs)           | Sim, REST    | Sim             | Melhor custo-benefício, UX moderna, docs em PT |
| **Clicksign**  | R$ 99/mês                     | Sim, v3 Envelope | Sim         | Mais tradicional no jurídico, robusta |
| **D4Sign**     | R$ 59/mês                     | Sim          | Sim (add-on)    | Forte em ICP-Brasil |
| **Autentique** | Plano grátis (5 docs/mês)     | Sim, GraphQL | Não             | Bom para volume baixo |

Fluxo típico (qualquer um dos quatro):
1. NEXO gera PDF do contrato → POST para a API com signatários (locador, locatário, fiador).
2. Plataforma envia link por e-mail/WhatsApp.
3. Cada signatário assina (e-mail+token, selfie, ou certificado).
4. Webhook avisa o NEXO → atualizamos `contracts.signed_at`, baixamos o PDF assinado e arquivamos em Storage.

### Caminho C — Assinatura própria dentro do NEXO
Implementar canvas de desenho + e-mail+token + hash SHA-256 + trilha de auditoria (IP, user-agent, timestamp, geolocalização). Anexar página de assinaturas ao PDF.

- **Validade jurídica:** sim, como **assinatura eletrônica simples** (Lei 14.063/2020 art. 4º I), aceita para contratos privados entre partes, mas **menor força probatória** em disputa do que avançada/qualificada.
- Custo zero por documento, mas precisamos manter a infra de evidências.
- Veredito: **viável como MVP gratuito**, recomendado combinar com Caminho B para clientes que querem validade reforçada.

## Recomendação para discussão

**Arquitetura híbrida em 2 camadas:**

1. **Padrão (incluso no plano)** — Assinatura própria (Caminho C) com trilha de auditoria. Cobre 90% dos contratos de locação residencial sem custo variável.
2. **Premium (add-on)** — Integração **ZapSign** (Caminho B) como primeira escolha pelo custo e API limpa, com webhook nos contratos. Liga-se via tela de Integrações.
3. **Sempre disponível** — Botão "Assinar no gov.br" que baixa o PDF e abre `assinador.iti.br` (Caminho A2) para quem prefere a via oficial gratuita.

Descartar Caminho A1 (API oficial) — bloqueio regulatório para empresas privadas.

## Perguntas para você decidir

1. Quer começar pela **assinatura própria** (sem custo, sem dependência externa) ou já partir direto para **ZapSign/Clicksign**?
2. Quem paga a assinatura paga: **a imobiliária** (fica no plano) ou **repassamos por contrato assinado** (modelo SaaS revenda)?
3. Vamos exigir signatários além de locador/locatário (fiador, testemunhas, cônjuge)?
4. WhatsApp como canal principal de envio do link de assinatura, e-mail, ou os dois?

Aguardo seu OK antes de planejar qualquer implementação.
