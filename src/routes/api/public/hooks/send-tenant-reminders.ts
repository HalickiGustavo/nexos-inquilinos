import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import {
  REMINDER_OFFSETS,
  buildReminderMessage,
  type ReminderStage,
} from "@/lib/whatsapp-templates";

// Régua diária de cobrança WhatsApp para inquilinos.
// Para cada parcela pendente/atrasada cujo `due_date` cai num dos offsets
// (-10, -5, -2, -1, +1, +2, +3, +5, +7 dias relativo a hoje), envia uma
// mensagem via Evolution API se ainda não houver registro do estágio.
//
// Idempotente: a tabela `installment_notifications` tem unique
// (installment_id, stage, channel), então execuções repetidas no mesmo dia
// não duplicam mensagens.
//
// Auth: Bearer CRON_SECRET (server-only).
export const Route = createFileRoute("/api/public/hooks/send-tenant-reminders")({
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

          // Hoje em BRT (America/Sao_Paulo, UTC-3) — basta operar em UTC
          // porque due_date é DATE (sem timezone). Usamos a data corrente
          // do servidor.
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          const stages = Object.entries(REMINDER_OFFSETS) as Array<
            [Exclude<ReminderStage, "welcome">, number]
          >;

          let processed = 0;
          let sent = 0;
          let failed = 0;
          let skipped = 0;

          for (const [stage, offset] of stages) {
            const target = new Date(today);
            target.setUTCDate(target.getUTCDate() + offset);
            const iso = target.toISOString().slice(0, 10);

            const { data: rows, error } = await supabaseAdmin
              .from("installments")
              .select(
                `id, contract_id, user_id, due_date, amount, status, boleto_url,
                 contracts:contract_id (
                   id,
                   tenants:tenant_id ( id, full_name, phone )
                 )`,
              )
              .eq("due_date", iso)
              .in("status", ["pendente", "atrasado", "em_aberto"]);

            if (error) {
              console.error("[reminders] select", stage, error.message);
              continue;
            }
            if (!rows || rows.length === 0) continue;

            // Quais já têm log desse estágio?
            const ids = rows.map((r: any) => r.id);
            const { data: existing } = await supabaseAdmin
              .from("installment_notifications")
              .select("installment_id")
              .eq("stage", stage)
              .eq("channel", "whatsapp")
              .in("installment_id", ids);
            const already = new Set(
              (existing ?? []).map((e: any) => e.installment_id),
            );

            for (const r of rows as any[]) {
              processed++;
              if (already.has(r.id)) continue;

              const tenant = r.contracts?.tenants;
              const phone: string | null = tenant?.phone ?? null;
              const nome: string = tenant?.full_name ?? "inquilino";

              if (!phone) {
                await supabaseAdmin.from("installment_notifications").insert({
                  installment_id: r.id,
                  contract_id: r.contract_id,
                  user_id: r.user_id,
                  channel: "whatsapp",
                  stage,
                  status: "skipped",
                  error: "tenant sem telefone",
                });
                skipped++;
                continue;
              }

              const text = buildReminderMessage(stage, {
                nome,
                valor: Number(r.amount ?? 0),
                vencimento: r.due_date,
                linkPagamento: r.boleto_url ?? null,
              });

              const res = await sendEvolutionText({ phone, text });

              await supabaseAdmin.from("installment_notifications").insert({
                installment_id: r.id,
                contract_id: r.contract_id,
                user_id: r.user_id,
                channel: "whatsapp",
                stage,
                status: res.ok ? "sent" : "failed",
                error: res.ok ? null : res.reason.slice(0, 500),
              });
              if (res.ok) sent++;
              else failed++;
            }
          }

          return Response.json({
            ok: true,
            date: today.toISOString().slice(0, 10),
            processed,
            sent,
            failed,
            skipped,
          });
        } catch (e: any) {
          console.error("[send-tenant-reminders] erro:", e);
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
