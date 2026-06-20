// Public webhook ingesting leads from real-estate portals (Zap, VivaReal, OLX, etc).
// Auth: per-agency token in body.token or X-Webhook-Token header → maps to agency_settings.manager_user_id.
// Routing logic:
//   1. If matched property has responsible_member_id → assign directly.
//   2. Else fall back to round-robin over active manager_members ordered by
//      the strategy stored in agency_settings.lead_routing_strategy.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendEvolutionText, sanitizeBrPhone } from "@/lib/whatsapp.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Token",
  "Access-Control-Max-Age": "86400",
};

const payloadSchema = z.object({
  token: z.string().min(10).optional(),
  portal: z.string().min(1).max(40).default("desconhecido"),
  property_code: z.string().min(1).max(80).optional(),
  property_external_id: z.string().max(120).optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  budget: z.number().nonnegative().optional(),
});

const STRATEGY_LABELS: Record<string, string> = {
  DIRECT_OR_ROUND_ROBIN_ALPHABETICAL: "Ordem Alfabética",
  DIRECT_OR_ROUND_ROBIN_SALES: "Volume de Vendas",
  DIRECT_OR_ROUND_ROBIN_TENURE: "Tempo de Trabalho",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/webhooks/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        let parsed: z.infer<typeof payloadSchema>;
        try {
          const raw = await request.json();
          parsed = payloadSchema.parse(raw);
        } catch (err: any) {
          return jsonResp({ received: false, error: "invalid_payload", detail: err?.message }, 400);
        }

        const headerToken = request.headers.get("x-webhook-token") ?? undefined;
        const token = parsed.token ?? headerToken;
        if (!token) return jsonResp({ received: false, error: "missing_token" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Identify agency by webhook token
        const { data: agency, error: agencyErr } = await supabaseAdmin
          .from("agency_settings")
          .select("manager_user_id, lead_routing_strategy, last_round_robin_member_id")
          .eq("webhook_token", token)
          .maybeSingle();
        if (agencyErr || !agency) return jsonResp({ received: false, error: "invalid_token" }, 401);

        const managerId = agency.manager_user_id as string;

        // 2. Match property by NEXO code (or external id stored on the same field)
        let property: { id: string; nickname: string; code: string | null; responsible_member_id: string | null } | null = null;
        const lookupCode = parsed.property_code ?? parsed.property_external_id;
        if (lookupCode) {
          const { data } = await supabaseAdmin
            .from("properties")
            .select("id, nickname, code, responsible_member_id")
            .eq("manager_id", managerId)
            .eq("code", lookupCode)
            .maybeSingle();
          property = data as any;
        }

        // 3. Decide routing
        let routedMemberId: string | null = null;
        let criteriaUsed = "Sem corretor disponível";

        if (property?.responsible_member_id) {
          const { data: direct } = await supabaseAdmin
            .from("manager_members")
            .select("id, is_active")
            .eq("id", property.responsible_member_id)
            .maybeSingle();
          if (direct?.is_active) {
            routedMemberId = direct.id;
            criteriaUsed = "Corretor do Imóvel";
          }
        }

        if (!routedMemberId) {
          const orderBy = (() => {
            switch (agency.lead_routing_strategy) {
              case "DIRECT_OR_ROUND_ROBIN_SALES":
                return { column: "total_sales_count" as const, ascending: true };
              case "DIRECT_OR_ROUND_ROBIN_TENURE":
                return { column: "hire_date" as const, ascending: true };
              default:
                return { column: "name" as const, ascending: true };
            }
          })();

          const { data: pool } = await supabaseAdmin
            .from("manager_members")
            .select("id, name, total_sales_count, hire_date")
            .eq("manager_user_id", managerId)
            .eq("is_active", true)
            .eq("status", "ativo")
            .order(orderBy.column, { ascending: orderBy.ascending });

          if (pool && pool.length > 0) {
            const lastIdx = agency.last_round_robin_member_id
              ? pool.findIndex((m) => m.id === agency.last_round_robin_member_id)
              : -1;
            const nextIdx = (lastIdx + 1) % pool.length;
            routedMemberId = pool[nextIdx].id;
            criteriaUsed = STRATEGY_LABELS[agency.lead_routing_strategy] ?? "Round-Robin";
            await supabaseAdmin
              .from("agency_settings")
              .update({ last_round_robin_member_id: routedMemberId })
              .eq("manager_user_id", managerId);
          }
        }

        // 4. Persist lead
        const { data: lead, error: insertErr } = await supabaseAdmin
          .from("crm_leads")
          .insert({
            manager_user_id: managerId,
            name: parsed.name,
            email: parsed.email ?? null,
            phone: parsed.phone ?? null,
            budget: parsed.budget ?? 0,
            interested_property_id: property?.id ?? null,
            interested_code: lookupCode ?? null,
            stage: "novos",
            notes: parsed.message ?? null,
            portal_origin: parsed.portal,
            routed_member_id: routedMemberId,
            routing_criteria_used: criteriaUsed,
            source: "portal",
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("[webhook.leads] insert failed", insertErr);
          return jsonResp({ received: true, routed: false, error: "persist_failed" }, 500);
        }

        // 5. Notify routed broker via WhatsApp (fire and forget)
        if (routedMemberId) {
          const { data: broker } = await supabaseAdmin
            .from("manager_members")
            .select("name, email, member_user_id")
            .eq("id", routedMemberId)
            .maybeSingle();

          if (broker?.member_user_id) {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("phone")
              .eq("id", broker.member_user_id)
              .maybeSingle();
            const phone = (profile as any)?.phone;
            if (phone && sanitizeBrPhone(phone)) {
              const text =
                `🔔 *Novo lead NEXO*\n` +
                `Cliente: ${parsed.name}\n` +
                (parsed.phone ? `Telefone: ${parsed.phone}\n` : "") +
                (property?.nickname ? `Imóvel: ${property.nickname}${property.code ? ` (${property.code})` : ""}\n` : "") +
                `Portal: ${parsed.portal}\n` +
                `Critério: ${criteriaUsed}`;
              sendEvolutionText({ phone, text }).catch((e) =>
                console.warn("[webhook.leads] whatsapp send failed", e),
              );
            }
          }
        }

        return jsonResp({ received: true, routed: !!routedMemberId, lead_id: lead.id });
      },
    },
  },
});
