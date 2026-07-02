import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/debug-stark-ping")({
  server: {
    handlers: {
      GET: async () => {
        const raw = (process.env.STARK_PROJECT_ID || "").trim();
        const accessId = /^(project|organization)\//i.test(raw)
          ? raw.replace(/^(project|organization)\//i, (m) => m.toLowerCase())
          : `project/${raw}`;
        const masked = accessId.replace(/(.{6}).+(.{4})/, "$1***$2");
        const hasPk = !!(process.env.STARK_PRIVATE_KEY || "").trim();
        const env = process.env.STARK_ENVIRONMENT || "sandbox";

        const { starkFetch, starkHost } = await import("@/lib/stark/stark.server");
        const results: any[] = [];
        try {
          const r = await starkFetch({ method: "GET", path: "/invoice", query: { limit: 1 } });
          results.push({ endpoint: "GET /invoice", ok: true, count: (r as any)?.invoices?.length });
        } catch (e: any) {
          results.push({ endpoint: "GET /invoice", ok: false, error: e?.message, body: e?.body });
        }
        try {
          const r = await starkFetch({ method: "GET", path: "/webhook" });
          results.push({ endpoint: "GET /webhook", ok: true, count: (r as any)?.webhooks?.length, list: r });
        } catch (e: any) {
          results.push({ endpoint: "GET /webhook", ok: false, error: e?.message, body: e?.body });
        }
        return Response.json({ host: starkHost(), env, hasPk, accessId: masked, accessIdLen: accessId.length, results });
      },
    },
  },
});
