// Unified leads webhook — identifies agency by clean org slug in the URL
// instead of requiring a raw token in the body. Routing logic is identical
// to /api/public/webhooks/leads (direct broker → round-robin by strategy).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sendEvolutionText, sanitizeBrPhone } from "@/lib/whatsapp.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const payloadSchema = z.object({
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

export const Route = createFileRoute("/api/v1/integrations/$orgSlug/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request, params }) => {
        const slug = String(params.orgSlug ?? "").toLowerCase();
        if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
          return jsonResp({ received: false, error: "invalid_slug" }, 400);
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          const raw = await request.json();
          parsed = payloadSchema.parse(raw);
        } catch (err: any) {
          return jsonResp({ received: false, error: "invalid_payload", detail: err?.message }, 400);
        }

        // Require shared secret token (header or body) to prevent slug-guessing lead injection
        const headerToken = request.headers.get("x-api-key") ?? request.headers.get("x-webhook-token") ?? undefined;
        const bodyToken = (parsed as any).token as string | undefined;
        const providedToken = headerToken ?? bodyToken;
        if (!providedToken || providedToken.length < 10) {
          return jsonResp({ received: false, error: "missing_token" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: agency } = await supabaseAdmin
          .from("agency_settings")
          .select("manager_user_id, lead_routing_strategy, last_round_robin_member_id, webhook_token")
          .eq("org_slug", slug)
          .maybeSingle();
        if (!agency?.manager_user_id || !agency.webhook_token) {
          return jsonResp({ received: false, error: "agency_not_found" }, 404);
        }
        if (agency.webhook_token !== providedToken) {
          return jsonResp({ received: false, error: "invalid_token" }, 401);
        }

        const managerId = agency.manager_user_id as string;

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
          console.error("[v1.leads] insert failed", insertErr);
          return jsonResp({ received: true, routed: false, error: "persist_failed" }, 500);
        }

        if (routedMemberId) {
          const { data: broker } = await supabaseAdmin
            .from("manager_members")
            .select("name, email, phone, member_user_id")
            .eq("id", routedMemberId)
            .maybeSingle();

          let phone: string | null = (broker as any)?.phone ?? null;
          if (!phone && broker?.member_user_id) {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("phone")
              .eq("id", broker.member_user_id)
              .maybeSingle();
            phone = (profile as any)?.phone ?? null;
          }

          if (phone && sanitizeBrPhone(phone)) {
            const text =
              `🔔 *Novo lead NEXO*\n` +
              `Cliente: ${parsed.name}\n` +
              (parsed.phone ? `Telefone: ${parsed.phone}\n` : "") +
              (property?.nickname ? `Imóvel: ${property.nickname}${property.code ? ` (${property.code})` : ""}\n` : "") +
              `Portal: ${parsed.portal}\n` +
              `Critério: ${criteriaUsed}`;
            sendEvolutionText({ phone, text }).catch((e) =>
              console.warn("[v1.leads] whatsapp send failed", e),
            );
          }
        }

        return jsonResp({ received: true, routed: !!routedMemberId, lead_id: lead.id });
      },
    },
  },
});
