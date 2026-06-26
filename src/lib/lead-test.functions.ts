import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEST_PRESETS, getPresetById } from "@/lib/whatsapp-test-presets";

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

export const listTestPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => TEST_PRESETS);

export const sendTestLeadNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId?: string; presetId?: string; text?: string }) =>
    z
      .object({
        memberId: z.string().uuid().optional(),
        presetId: z.string().min(1).optional(),
        text: z.string().min(1).max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Role gate: apenas managers/owners podem disparar mensagens via a
    // instância Evolution da plataforma (evita abuso de quota por inquilinos
    // ou proprietários autenticados).
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    if (!isManager && !isOwner) {
      throw new Error("Forbidden");
    }

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

    // Texto final: prioriza texto editado pelo usuário, depois o preset, depois fallback.
    let text = (data.text ?? "").trim();
    if (!text && data.presetId) {
      text = getPresetById(data.presetId)?.sample ?? "";
    }
    if (!text) {
      text =
        `🔔 *Mensagem de teste NEXO*\n\n` +
        `Esta é uma mensagem de teste enviada pelo painel${memberName ? ` para ${memberName}` : ""}.`;
    }

    const res = await sendEvolutionText({ phone, text });
    if (!res.ok) {
      console.error("[sendTestLeadNotification] falha Evolution:", res);
      throw new Error(
        `Falha ao enviar via Evolution (${res.reason}${res.status ? ` • HTTP ${res.status}` : ""})`,
      );
    }
    return { ok: true, phone, memberName };
  });
