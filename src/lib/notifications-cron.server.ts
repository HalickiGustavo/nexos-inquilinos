import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsAppText } from "./whatsapp.server";
import { sendResendEmail } from "./resend.server";

export async function processNotificationQueue() {
  const now = new Date();
  
  // 1. Fetch pending installments due in 4 days
  const fourDaysFromNow = new Date();
  fourDaysFromNow.setDate(now.getDate() + 4);
  const fourDaysStr = fourDaysFromNow.toISOString().split('T')[0];

  const { data: upcoming, error: err1 } = await supabaseAdmin
    .from("installments")
    .select(`
      id,
      amount,
      due_date,
      status,
      contract:contracts (
        id,
        tenant:profiles!contracts_user_id_fkey (
          full_name,
          email,
          phone
        )
      )
    `)
    .eq("status", "pendente")
    .eq("due_date", fourDaysStr);

  if (err1) console.error("Error fetching upcoming installments:", err1);
  else if (upcoming) {
    for (const inst of upcoming) {
      await sendPaymentReminder(inst, "Lembrete: Sua fatura vence em 4 dias.");
    }
  }

  // 2. Fetch pending installments due today (Fatura pendente)
  const todayStr = now.toISOString().split('T')[0];
  const { data: pendingToday, error: err2 } = await supabaseAdmin
    .from("installments")
    .select(`
      id,
      amount,
      due_date,
      status,
      contract:contracts (
        id,
        tenant:profiles!contracts_user_id_fkey (
          full_name,
          email,
          phone
        )
      )
    `)
    .eq("status", "pendente")
    .eq("due_date", todayStr);

  if (err2) console.error("Error fetching pending today:", err2);
  else if (pendingToday) {
    for (const inst of pendingToday) {
      await sendPaymentReminder(inst, "Aviso: Sua fatura vence hoje.");
    }
  }

  // 3. Fetch overdue installments (Fatura vencida)
  const { data: overdue, error: err3 } = await supabaseAdmin
    .from("installments")
    .select(`
      id,
      amount,
      due_date,
      status,
      contract:contracts (
        id,
        tenant:profiles!contracts_user_id_fkey (
          full_name,
          email,
          phone
        )
      )
    `)
    .eq("status", "pendente")
    .lt("due_date", todayStr);

  if (err3) console.error("Error fetching overdue:", err3);
  else if (overdue) {
    for (const inst of overdue) {
      await sendPaymentReminder(inst, "Atenção: Sua fatura está vencida.");
    }
  }
}

async function sendPaymentReminder(installment: any, title: string) {
  const tenant = (installment.contract as any)?.tenant;
  if (!tenant) return;

  const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installment.amount);
  const message = `${title}\nValor: ${amountFormatted}\nVencimento: ${installment.due_date}\n\nPara pagar, acesse o painel Nexo.`;

  // WhatsApp via Evolution API
  if (tenant.phone) {
    const result = await sendWhatsAppText({
      phone: tenant.phone,
      text: message
    });
    if (!result.ok) {
      console.error(`Failed to send WhatsApp to ${tenant.phone}: ${result.reason}`);
    }
  } else {
    console.warn(`No phone number for tenant in installment ${installment.id}`);
  }

  // Email via Resend
  if (tenant.email) {
    try {
      await sendResendEmail({
        to: tenant.email,
        subject: title,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      });
    } catch (error) {
      console.error(`Failed to send email to ${tenant.email}:`, error);
    }
  } else {
    console.warn(`No email for tenant in installment ${installment.id}`);
  }

  // TODO: Add record to a 'notifications_sent' table to prevent duplicates in the same day
}
