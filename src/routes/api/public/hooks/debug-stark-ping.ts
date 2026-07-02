import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/debug-stark-ping")({
  server: {
    handlers: {
      GET: async () => {
        const { starkFetch, starkHost } = await import("@/lib/stark/stark.server");
        const attempts: any[] = [];
        // Try get one invoice from list
        try {
          const r = await starkFetch({ method: "GET", path: "/invoice", query: { limit: 3 } });
          attempts.push({ ok: true, host: starkHost(), invoicesCount: (r as any)?.invoices?.length, first: (r as any)?.invoices?.[0] });
        } catch (e: any) {
          attempts.push({ ok: false, host: starkHost(), error: e?.message, body: e?.body });
        }
        return Response.json({ attempts });
      },
    },
  },
});
