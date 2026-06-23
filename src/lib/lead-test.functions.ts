import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTeamMembersForTest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("manager_members")
      .select("id, name, email, phone, role_label, status")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).filter((m: any) => m.phone && m.phone.trim().length > 0);
  });

export const sendTestLeadNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId?: string }) =>
    z.object({ memberId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendEvolutionText, sanitizeBrPhone } = await import("@/lib/whatsapp.server");

    let phone: string | null = null;
    let memberName: string | null = null;

    if (data.memberId) {
      const { data: member, error } = await context.supabase
        .from("manager_members")
        .select("name, phone")
        .eq("id", data.memberId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      phone = (member as any)?.phone ?? null;
      memberName = (member as any)?.name ?? null;
    } else {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("id", context.userId)
        .maybeSingle();
      phone = (profile as any)?.phone ?? null;
      memberName = (profile as any)?.full_name ?? null;
    }

    if (!phone || !sanitizeBrPhone(phone)) {
      throw new Error("Telefone inválido. O membro selecionado não possui telefone cadastrado.");
    }

    const text =
      `🔔 *Novo lead NEXO* (TESTE)\n` +
      `Cliente: João da Silva\n` +
      `Telefone: (41) 99999-0000\n` +
      `Imóvel: Imóvel Teste — Gustavpo (IM-TESTE)\n` +
      `Portal: ZapImóveis\n` +
      `Critério: Corretor do Imóvel\n\n` +
      `_Esta é uma mensagem de teste enviada pelo painel NEXO${memberName ? ` para ${memberName}` : ""}._`;

    const res = await sendEvolutionText({ phone, text });
    if (!res.ok) {
      console.error("[sendTestLeadNotification] falha Evolution:", res);
      throw new Error(
        `Falha ao enviar via Evolution (${res.reason}${res.status ? ` • HTTP ${res.status}` : ""})`,
      );
    }
    return { ok: true, phone, memberName };
  });
