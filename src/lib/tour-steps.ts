import type { TourStep } from "@/components/OnboardingTour";

export const ownerTourSteps: TourStep[] = [
  {
    target: "nav-dashboard",
    title: "Visão Geral",
    description:
      "Aqui você vê um resumo do seu negócio: total de imóveis, contratos ativos, recebimentos do mês e alertas importantes.",
  },
  {
    target: "nav-conta-corrente",
    title: "Conta Corrente",
    description:
      "Acompanhe entradas e saídas de cada imóvel, com o saldo atualizado em tempo real.",
  },
  {
    target: "nav-properties",
    title: "Imóveis",
    description:
      "Cadastre seus imóveis, adicione fotos, endereço e valores. Tudo o que envolve cada imóvel parte daqui.",
  },
  {
    target: "nav-tenants",
    title: "Inquilinos",
    description: "Cadastre e gerencie seus inquilinos, com dados de contato e histórico de pagamentos.",
  },
  {
    target: "nav-contracts",
    title: "Contratos",
    description:
      "Crie contratos de locação, defina valores, datas de reajuste e gere as parcelas automaticamente.",
  },
  {
    target: "nav-financials",
    title: "Finanças",
    description:
      "Veja todas as cobranças, marque pagamentos recebidos, envie boletos e acompanhe inadimplência.",
  },
  {
    target: "nav-maintenances",
    title: "Manutenções",
    description:
      "Receba e acompanhe solicitações de manutenção dos inquilinos, com orçamentos, fotos e chat.",
  },
  {
    target: "nav-integrations",
    title: "Saldo e Saque",
    description:
      "Veja o saldo disponível da sua conta e solicite saques para a sua conta bancária quando quiser.",
  },
];

export const managerTourSteps: TourStep[] = [
  {
    target: "nav-manager",
    title: "Dashboard",
    description:
      "Visão geral da imobiliária: contratos ativos, recebimentos do mês, inadimplência e atividades recentes.",
  },
  {
    target: "nav-manager-carteira",
    title: "Carteira",
    description:
      "Gerencie todos os imóveis e proprietários sob sua administração em um só lugar.",
  },
  {
    target: "nav-manager-financeiro",
    title: "Financeiro",
    description:
      "Acompanhe cobranças, repasses aos proprietários, taxas de administração e inadimplência.",
  },
  {
    target: "nav-manager-dimob",
    title: "DIMOB",
    description:
      "Gere a declaração DIMOB para a Receita Federal a partir dos contratos e recebimentos do ano.",
  },
  {
    target: "nav-manager-equipe",
    title: "Equipe",
    description:
      "Convide e gerencie corretores e funcionários, com permissões adequadas para cada um.",
  },
  {
    target: "nav-manager-vistorias",
    title: "Vistorias",
    description:
      "Agende e registre vistorias de entrada e saída, com fotos e checklist por ambiente.",
  },
  {
    target: "nav-manager-alertas",
    title: "Alertas",
    description:
      "Avisos importantes que precisam da sua atenção: vencimentos, atrasos, documentos pendentes.",
  },
  {
    target: "nav-manager-crm",
    title: "CRM",
    description:
      "Funil de captação e atendimento: organize leads, propostas e visitas em um quadro estilo Kanban.",
  },
  {
    target: "nav-manager-integracao",
    title: "Saldo e Saque",
    description:
      "Consulte o saldo da imobiliária e faça saques para a conta bancária cadastrada.",
  },
  {
    target: "nav-manager-portais",
    title: "Portais de Venda",
    description:
      "Compartilhe seus imóveis em portais externos com um link único que se atualiza sozinho.",
  },
  {
    target: "nav-manager-migrar-dados",
    title: "Migrar Dados",
    description:
      "Importe imóveis, inquilinos e contratos de outros sistemas usando planilhas.",
  },
];

export const tenantTourSteps: TourStep[] = [
  {
    target: "nav-tenant",
    title: "Início",
    description:
      "Tela inicial com os principais avisos: próximas parcelas, manutenções em andamento e mensagens.",
  },
  {
    target: "nav-tenant-financeiro",
    title: "Financeiro",
    description:
      "Veja suas parcelas em aberto, pague pelo Pix ou boleto e baixe seus recibos.",
  },
  {
    target: "nav-tenant-contrato",
    title: "Contrato",
    description:
      "Consulte os dados do seu contrato, datas de reajuste, vencimento e o documento em PDF.",
  },
  {
    target: "nav-tenant-manutencoes",
    title: "Manutenções",
    description:
      "Abra solicitações de manutenção, envie fotos do problema e acompanhe o atendimento.",
  },
  {
    target: "nav-tenant-alertas",
    title: "Alertas",
    description:
      "Avisos do proprietário ou da imobiliária, como reajustes, comunicados e datas importantes.",
  },
];
