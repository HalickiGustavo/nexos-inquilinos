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
          const { error } = await supabaseAdmin.rpc("sync_cron_secret", { _secret: secret });
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
