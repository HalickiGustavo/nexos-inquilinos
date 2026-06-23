import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { buildMaintenanceResponseReminder } from "@/lib/whatsapp-templates";

// Notifica imobiliária/proprietário quando o inquilino enviou uma mensagem
// numa solicitação de manutenção há mais de 24h e ninguém respondeu.
//
// Idempotente: a tabela `maintenance_response_notifications` tem UNIQUE
// (maintenance_id, last_tenant_message_id, channel). Para cada nova
// mensagem do inquilino sem resposta posterior, no máximo um aviso.
//
// Auth: Bearer CRON_SECRET.
export const Route = createFileRoute(
  "/api/public/hooks/send-maintenance-response-reminders",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const header =
          request.headers.get("authorization") ??
          request.headers.get("Authorization") ??
          "";
        const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
        const a = provided ? Buffer.from(provided) : null;
        const b = expected ? Buffer.from(expected) : null;
        const ok =
          !!a && !!b && a.length === b.length && timingSafeEqual(a, b);
        if (!ok) return new Response("Unauthorized", { status: 401 });

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { sendEvolutionText } = await import("@/lib/whatsapp.server");

          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

          // Manutenções com tenant vinculado, não concluídas.
          const { data: maintenances, error: mErr } = await supabaseAdmin
            .from("maintenances")
            .select(
              `id, user_id, title, status, tenant_id,
               property:property_id ( nickname, responsible_member_id ),
               tenant:tenant_id ( id, full_name, user_id_link )`,
            )
            .neq("status", "concluido")
            .not("tenant_id", "is", null);

          if (mErr) throw mErr;
          if (!maintenances || maintenances.length === 0) {
            return Response.json({ ok: true, processed: 0, sent: 0 });
          }

          let processed = 0;
          let sent = 0;
          let failed = 0;
          let skipped = 0;

          for (const m of maintenances as any[]) {
            processed++;
            const tenantUserId: string | null = m.tenant?.user_id_link ?? null;
            if (!tenantUserId) continue;

            // Última mensagem da conversa
            const { data: lastMsg } = await supabaseAdmin
              .from("maintenance_messages")
              .select("id, sender_user_id, created_at")
              .eq("maintenance_id", m.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!lastMsg) continue;
            // Só nudge se a última msg é do inquilino e está sem resposta há >= 24h
            if (lastMsg.sender_user_id !== tenantUserId) continue;
            if (new Date(lastMsg.created_at) > cutoff) continue;

            // Já notificamos por essa mensagem?
            const { data: existing } = await supabaseAdmin
              .from("maintenance_response_notifications")
              .select("id")
              .eq("maintenance_id", m.id)
              .eq("last_tenant_message_id", lastMsg.id)
              .eq("channel", "whatsapp")
              .maybeSingle();
            if (existing) continue;

            // Telefone do owner/manager (dono da manutenção)
            const { data: ownerProfile } = await supabaseAdmin
              .from("profiles")
              .select("full_name, phone")
              .eq("id", m.user_id)
              .maybeSingle();

            const ownerPhone: string | null = ownerProfile?.phone ?? null;
            const ownerName: string = ownerProfile?.full_name ?? "responsável";

            if (!ownerPhone) {
              await supabaseAdmin
                .from("maintenance_response_notifications")
                .insert({
                  maintenance_id: m.id,
                  last_tenant_message_id: lastMsg.id,
                  user_id: m.user_id,
                  channel: "whatsapp",
                  status: "skipped",
                  error: "owner sem telefone",
                });
              skipped++;
              continue;
            }

            const hoursWaiting = Math.floor(
              (Date.now() - new Date(lastMsg.created_at).getTime()) /
                (60 * 60 * 1000),
            );

            const text = buildMaintenanceResponseReminder({
              ownerName,
              tenantName: m.tenant?.full_name ?? "Inquilino",
              maintenanceTitle: m.title,
              propertyNickname: m.property?.nickname ?? null,
              hoursWaiting,
            });

            const res = await sendEvolutionText({ phone: ownerPhone, text });

            await supabaseAdmin
              .from("maintenance_response_notifications")
              .insert({
                maintenance_id: m.id,
                last_tenant_message_id: lastMsg.id,
                user_id: m.user_id,
                channel: "whatsapp",
                status: res.ok ? "sent" : "failed",
                error: res.ok ? null : res.reason.slice(0, 500),
              });

            if (res.ok) sent++;
            else failed++;
          }

          return Response.json({
            ok: true,
            processed,
            sent,
            failed,
            skipped,
          });
        } catch (e: any) {
          console.error("[send-maintenance-response-reminders] erro:", e);
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
