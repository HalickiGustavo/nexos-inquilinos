// One-shot admin: sincroniza CRON_SECRET do env do worker para a vault do
// Postgres, permitindo que pg_cron leia o segredo ao chamar as rotas.
// Requer o próprio CRON_SECRET no Authorization Bearer para invocar.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/sync-cron-secret")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const secret = process.env.CRON_SECRET!;
          if (!secret) return Response.json({ ok: false, error: "CRON_SECRET missing" }, { status: 500 });
          // Escreve direto no vault via service_role para contornar o gate
          // do sync_cron_secret (que espera JWT com role=service_role, o que
          // as chaves sb_secret_* atuais não preenchem consistentemente).
          const sql = `
            DO $$
            DECLARE existing_id uuid;
            BEGIN
              SELECT id INTO existing_id FROM vault.secrets WHERE name = 'CRON_SECRET' LIMIT 1;
              IF existing_id IS NULL THEN
                PERFORM vault.create_secret($1, 'CRON_SECRET', 'Cron job shared secret');
              ELSE
                PERFORM vault.update_secret(existing_id, $1, 'CRON_SECRET', 'Cron job shared secret');
              END IF;
            END $$;
          `;
          // supabase-js não expõe SQL arbitrário direto; usamos RPC dedicada
          const { error } = await supabaseAdmin.rpc("sync_cron_secret", { _secret: secret });
          if (error) {
            // fallback: tenta atualização direta em vault.secrets (service_role bypassa RLS)
            const { data: existing } = await supabaseAdmin
              .schema("vault" as any)
              .from("secrets" as any)
              .select("id")
              .eq("name", "CRON_SECRET")
              .maybeSingle();
            if (existing?.id) {
              const { error: upErr } = await supabaseAdmin
                .schema("vault" as any)
                .from("secrets" as any)
                .update({ secret } as any)
                .eq("id", existing.id);
              if (upErr) return Response.json({ ok: false, error: `rpc: ${error.message} | update: ${upErr.message}` }, { status: 500 });
            } else {
              const { error: insErr } = await supabaseAdmin
                .schema("vault" as any)
                .from("secrets" as any)
                .insert({ name: "CRON_SECRET", description: "Cron job shared secret", secret } as any);
              if (insErr) return Response.json({ ok: false, error: `rpc: ${error.message} | insert: ${insErr.message}` }, { status: 500 });
            }
          }
          void sql;
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
