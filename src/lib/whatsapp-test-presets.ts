// Catálogo de mensagens automáticas enviadas pelo sistema via WhatsApp.
// Usado pela tela "Testar notificação" para permitir selecionar e editar
// qualquer template antes do envio de teste.

import {
  buildWelcomeMessage,
  buildReminderMessage,
  buildMaintenanceResponseReminder,
  REMINDER_OFFSETS,
  stageLabel,
  type ReminderStage,
} from "./whatsapp-templates";

export type TestPreset = {
  id: string;
  label: string;
  group: "Leads" | "Cadastro" | "Cobrança" | "Manutenção";
  description: string;
  sample: string;
};

const SAMPLE_LEAD = {
  cliente: "João da Silva",
  telefone: "(41) 99999-0000",
  imovel: "Apto Teste — Corretor Gustavo (IM-TESTE)",
  portal: "ZapImóveis",
  criterio: "Corretor do Imóvel",
};

const SAMPLE_TENANT = { nome: "Maria Souza", email: "maria@email.com" };
const SAMPLE_OWNER = { nome: "Carlos Almeida", email: "carlos@email.com" };

const SAMPLE_REMINDER = {
  nome: "Maria Souza",
  valor: 2350,
  vencimento: "2026-07-10",
  linkPagamento: "https://www.asaas.com/i/abc123xyz",
};

const APP_ORIGIN = "https://dashboard.usenexoapp.com";

function sampleLeadMessage(): string {
  return (
    `🔔 *Novo lead NEXO* (TESTE)\n` +
    `Cliente: ${SAMPLE_LEAD.cliente}\n` +
    `Telefone: ${SAMPLE_LEAD.telefone}\n` +
    `Imóvel: ${SAMPLE_LEAD.imovel}\n` +
    `Portal: ${SAMPLE_LEAD.portal}\n` +
    `Critério: ${SAMPLE_LEAD.criterio}\n\n` +
    `_Esta é uma mensagem de teste enviada pelo painel NEXO._`
  );
}

function sampleTenantInvite(): string {
  const first = SAMPLE_TENANT.nome.split(" ")[0];
  const link = "https://nexo.app/auth/aceitar-convite?token=teste";
  return (
    `Olá, ${first}! 👋\n\n` +
    `Você foi convidado para acessar o *Portal do Inquilino da Nexo*.\n\n` +
    `Acesse o link abaixo para configurar sua senha e finalizar o cadastro:\n\n` +
    `${link}\n\nQualquer dúvida, fale com a sua imobiliária.`
  );
}

function sampleOwnerInvite(): string {
  const first = SAMPLE_OWNER.nome.split(" ")[0];
  const link = "https://nexo.app/auth/aceitar-convite?token=teste";
  return (
    `Olá, ${first}! 👋\n\n` +
    `Você foi convidado para acessar o *Portal do Proprietário da Nexo*.\n\n` +
    `Acesse o link abaixo para criar sua senha e acompanhar seus imóveis, ` +
    `repasses e contratos:\n\n${link}\n\n` +
    `Qualquer dúvida, fale com a sua imobiliária.`
  );
}

const reminderPresets: TestPreset[] = (
  Object.keys(REMINDER_OFFSETS) as Array<keyof typeof REMINDER_OFFSETS>
).map((stage) => ({
  id: `cobranca-${stage}`,
  label: `Cobrança — ${stageLabel(stage as ReminderStage)}`,
  group: "Cobrança" as const,
  description: "Lembrete automático de aluguel enviado ao inquilino.",
  sample: buildReminderMessage(stage as Exclude<ReminderStage, "welcome">, SAMPLE_REMINDER),
}));

export const TEST_PRESETS: TestPreset[] = [
  {
    id: "lead-novo",
    label: "Novo lead (portal)",
    group: "Leads",
    description:
      "Mensagem enviada ao corretor quando um lead chega de um portal (ZapImóveis, VivaReal, Imovelweb).",
    sample: sampleLeadMessage(),
  },
  {
    id: "boas-vindas-inquilino",
    label: "Boas-vindas inquilino",
    group: "Cadastro",
    description: "Disparada ao criar a conta do inquilino na Nexo.",
    sample: buildWelcomeMessage(SAMPLE_TENANT.nome, SAMPLE_TENANT.email),
  },
  {
    id: "convite-inquilino",
    label: "Convite inquilino (Portal do Inquilino)",
    group: "Cadastro",
    description: "Enviada ao inquilino com o link para criar senha e acessar o portal.",
    sample: sampleTenantInvite(),
  },
  {
    id: "convite-proprietario",
    label: "Convite proprietário (Portal do Proprietário)",
    group: "Cadastro",
    description: "Enviada ao proprietário com o link para acessar o painel.",
    sample: sampleOwnerInvite(),
  },
  ...reminderPresets,
  {
    id: "manutencao-resposta",
    label: "Lembrete manutenção sem resposta",
    group: "Manutenção",
    description:
      "Avisa o proprietário/gestor quando um chamado de manutenção do inquilino aguarda retorno.",
    sample: buildMaintenanceResponseReminder({
      ownerName: "Carlos Almeida",
      tenantName: "Maria Souza",
      maintenanceTitle: "Vazamento na pia da cozinha",
      propertyNickname: "Apto 302 — Ed. Aurora",
      hoursWaiting: 24,
    }),
  },
];

export function getPresetById(id: string): TestPreset | undefined {
  return TEST_PRESETS.find((p) => p.id === id);
}
