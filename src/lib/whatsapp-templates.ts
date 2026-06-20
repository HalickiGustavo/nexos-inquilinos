// Templates de mensagens WhatsApp. Pure functions — sem side effects.
// Editar copy aqui.

export type ReminderStage =
  | "welcome"
  | "pre-10"
  | "pre-5"
  | "pre-2"
  | "pre-1"
  | "post-1"
  | "post-2"
  | "post-3"
  | "post-5"
  | "post-7";

export const REMINDER_OFFSETS: Record<Exclude<ReminderStage, "welcome">, number> = {
  // negativo = antes do vencimento, positivo = depois
  "pre-10": -10,
  "pre-5": -5,
  "pre-2": -2,
  "pre-1": -1,
  "post-1": 1,
  "post-2": 2,
  "post-3": 3,
  "post-5": 5,
  "post-7": 7,
};

function firstName(nome: string): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "inquilino";
}

function brl(amount: number): string {
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function buildWelcomeMessage(nome: string, email: string): string {
  const f = firstName(nome);
  return (
    `Olá, *${f}*! Boas-vindas à *NEXO*. 👋\n\n` +
    `Para concluir seu cadastro e acessar o painel do inquilino, ` +
    `confirme seu e-mail em *${email}* (verifique também a caixa de spam). ` +
    `Depois é só criar sua senha e pronto.\n\n` +
    `Qualquer dúvida, estamos por aqui. 🚀`
  );
}

export type ReminderContext = {
  nome: string;
  valor: number;
  vencimento: string; // ISO yyyy-mm-dd
  linkPagamento?: string | null;
};

export function buildReminderMessage(
  stage: Exclude<ReminderStage, "welcome">,
  ctx: ReminderContext,
): string {
  const f = firstName(ctx.nome);
  const v = brl(ctx.valor);
  const d = fmtDate(ctx.vencimento);
  const link = ctx.linkPagamento ? `\n\nPagamento: ${ctx.linkPagamento}` : "";

  switch (stage) {
    case "pre-10":
      return (
        `Oi, *${f}*! Tudo bem? 😊\n\n` +
        `Passando para lembrar que o seu aluguel de *${v}* vence em *${d}* (em 10 dias).${link}\n\n` +
        `Qualquer dúvida, é só chamar.`
      );
    case "pre-5":
      return (
        `Olá, *${f}*! Lembrete amigável: faltam *5 dias* para o vencimento do aluguel de *${v}* (em *${d}*).${link}`
      );
    case "pre-2":
      return (
        `Oi, *${f}*! Seu aluguel de *${v}* vence em *${d}* — daqui a *2 dias*.${link}\n\n` +
        `Se já pagou, pode desconsiderar. 👍`
      );
    case "pre-1":
      return (
        `*${f}*, último lembrete: o aluguel de *${v}* vence *amanhã (${d})*.${link}`
      );
    case "post-1":
      return (
        `Oi, *${f}*. Identificamos que o aluguel de *${v}* (venc. *${d}*) ainda não foi compensado. ` +
        `Pode regularizar hoje?${link}\n\n` +
        `Se o pagamento já foi feito, desconsidere esta mensagem.`
      );
    case "post-2":
      return (
        `*${f}*, o aluguel de *${v}* venceu em *${d}* e está em aberto há 2 dias. ` +
        `Pedimos a gentileza de regularizar.${link}`
      );
    case "post-3":
      return (
        `*${f}*, o pagamento do aluguel de *${v}* (venc. *${d}*) segue pendente há 3 dias. ` +
        `Solicitamos a regularização para evitar acréscimos.${link}`
      );
    case "post-5":
      return (
        `*${f}*, atenção: o aluguel de *${v}* venceu em *${d}* há 5 dias. ` +
        `A partir de agora incidem *multa e juros* conforme o contrato.${link}\n\n` +
        `Por favor, entre em contato se precisar de ajuda.`
      );
    case "post-7":
      return (
        `*${f}*, este é um aviso importante: o aluguel de *${v}* (venc. *${d}*) está em atraso há 7 dias. ` +
        `Sem regularização, o débito poderá ser encaminhado para cobrança formal.${link}\n\n` +
        `Estamos à disposição para negociar.`
      );
  }
}

export function stageLabel(stage: ReminderStage): string {
  const map: Record<ReminderStage, string> = {
    welcome: "Boas-vindas",
    "pre-10": "10 dias antes",
    "pre-5": "5 dias antes",
    "pre-2": "2 dias antes",
    "pre-1": "1 dia antes",
    "post-1": "1 dia em atraso",
    "post-2": "2 dias em atraso",
    "post-3": "3 dias em atraso",
    "post-5": "5 dias em atraso",
    "post-7": "7 dias em atraso",
  };
  return map[stage];
}

export function buildMaintenanceResponseReminder(params: {
  ownerName: string;
  tenantName: string;
  maintenanceTitle: string;
  propertyNickname?: string | null;
  hoursWaiting: number;
}): string {
  const f = firstName(params.ownerName);
  const local = params.propertyNickname ? ` (${params.propertyNickname})` : "";
  return (
    `Olá, *${f}*! 🛠️\n\n` +
    `O inquilino *${params.tenantName}* enviou uma mensagem na solicitação ` +
    `*"${params.maintenanceTitle}"*${local} há mais de *${params.hoursWaiting}h* e ainda aguarda retorno.\n\n` +
    `Por favor, responda no painel da NEXO assim que possível para manter o atendimento em dia. 🙏`
  );
}
