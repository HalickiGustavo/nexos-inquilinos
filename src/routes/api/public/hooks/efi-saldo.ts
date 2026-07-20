import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/efi-saldo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const { efiSaldoGet } = await import("@/lib/efi/payouts.server");
          const saldo = await efiSaldoGet();
          return Response.json({
            ok: true,
            saldo,
            payer_key: process.env.EFI_PIX_KEY ?? null,
            env: process.env.EFI_ENV ?? null,
          });
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
