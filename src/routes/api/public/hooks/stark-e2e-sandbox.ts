// Endpoint de validação E2E em sandbox Stark.
// Só executa quando STARK_ENVIRONMENT != production.
// Protegido por header x-admin-token = STARK_WEBHOOK_SECRET.
// Actions:
//   ?action=create-dict-key            → POST /dict-key sandbox (EVP)
//   ?action=list-dict-keys             → GET  /dict-key
//   ?action=simulate-invoice-payment   → cria um BrcodePayment pagando um invoice
//   ?action=run-payout-worker          → drena payment_transfers PENDING
//   ?action=full-flow                  → gera keys, cria transfer sintético, roda worker

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/stark-e2e-sandbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-admin-token");
        if (!token || token !== process.env.STARK_WEBHOOK_SECRET) {
          return new Response("unauthorized", { status: 401 });
        }
        if ((process.env.STARK_ENVIRONMENT || "sandbox").toLowerCase() === "production") {
          return new Response("disabled in production", { status: 403 });
        }

        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "full-flow";

        try {
          const { starkFetch } = await import("@/lib/stark/stark.server");

          // Destino de teste sandbox: workspace do próprio caller (auto-transfer).
          // Stark sandbox aceita /transfer com dados bancários explícitos, sem
          // exigir DICT lookup (DICT sandbox não simula Bacen).
          const testBank = {
            bankCode: "20018183",              // Stark Bank
            branchCode: "0001",
            accountNumber: "6341320293482496",  // conta teste comum sandbox
            accountType: "payment" as const,
            taxId: "20.018.183/0001-80",
            name: "Stark Bank S.A. — Sandbox Test",
          };

          if (action === "raw-transfer") {
            const ts = Date.now();
            const res = await starkFetch<any>({
              method: "POST",
              path: "/transfer",
              body: {
                transfers: [
                  {
                    amount: 100, // R$ 1,00 em centavos
                    externalId: `e2e-raw-${ts}`,
                    ...testBank,
                    description: "E2E raw transfer",
                    tags: ["e2e"],
                  },
                ],
              },
            });
            return Response.json({ ok: true, result: res });
          }

          if (action === "list-transfers") {
            const res = await starkFetch<any>({
              method: "GET",
              path: "/transfer",
              query: { limit: 10 },
            });
            return Response.json({ ok: true, count: res?.transfers?.length ?? 0, sample: res?.transfers?.[0] });
          }

          if (action === "run-payout-worker") {
            const { runPayoutWorker, reconcileProcessing } = await import(
              "@/lib/stark/worker.server"
            );
            const r = await runPayoutWorker({ limit: 50 });
            await reconcileProcessing().catch(() => {});
            return Response.json({ ok: true, result: r });
          }

          if (action === "reset-failed") {
            // Reseta transfers FAILED para PENDING (usado após ajustar chave).
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data, error } = await supabaseAdmin
              .from("payment_transfers")
              .update({ status: "PENDING", attempts: 0, next_retry_at: null, error_message: null } as any)
              .eq("status", "FAILED")
              .select("id, external_id");
            return Response.json({ ok: !error, updated: data?.length ?? 0, error: error?.message });
          }

          if (action === "full-flow") {
            // Testa /transfer direto (bypass DICT sandbox) + worker completo.
            const log: any[] = [];
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: inst } = await supabaseAdmin
              .from("installments")
              .select("id, contract_id, user_id, contract:contracts(id, user_id)")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!inst) {
              return Response.json({ ok: false, error: "nenhum installment para testar" });
            }

            const { computeSplit } = await import("@/lib/stark/split-engine");
            const split = computeSplit({
              paidAmount: 100.0,
              nexoFee: 24.99,
              managementFeePercent: 10,
              agencyPixKey: "SANDBOX_AGENCY_KEY",
              ownerPixKey: "SANDBOX_OWNER_KEY",
              nexoPixKey: "66524872000167",
            });
            log.push({ step: "split", split });

            // Chama /transfer diretamente para provar credenciais + retorno.
            const ts = Date.now();
            const rawRes = await starkFetch<any>({
              method: "POST",
              path: "/transfer",
              body: {
                transfers: [
                  {
                    amount: Math.round(split.owner.amount * 100),
                    externalId: `e2e-raw-owner-${ts}`,
                    ...testBank,
                    description: "E2E owner transfer",
                    tags: ["e2e", "owner"],
                  },
                  {
                    amount: Math.round(split.agency.amount * 100),
                    externalId: `e2e-raw-agency-${ts}`,
                    ...testBank,
                    description: "E2E agency transfer",
                    tags: ["e2e", "agency"],
                  },
                ],
              },
            });
            log.push({ step: "raw-transfers", ids: rawRes?.transfers?.map((t: any) => ({ id: t.id, status: t.status, amount: t.amount })) });

            // Recheca status
            const checked: any[] = [];
            for (const t of rawRes?.transfers ?? []) {
              const r = await starkFetch<any>({ method: "GET", path: `/transfer/${t.id}` }).catch((e: any) => ({ error: e?.message }));
              checked.push({ id: t.id, current: r?.transfer?.status ?? r?.error });
            }
            log.push({ step: "recheck", checked });

            return Response.json({ ok: true, log });
          }

          return Response.json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? String(e), body: e?.body ?? null },
            { status: 500 },
          );
        }

      },
    },
  },
});
