import { createFileRoute } from "@tanstack/react-router";
import { handleExternal, ok } from "@/lib/external-api/core.server";

export const Route = createFileRoute("/api/public/external/v1/health")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleExternal(request, "crm.read", async ({ key }) =>
          ok({
            status: "ok",
            service: "nexo-external-api",
            version: "v1",
            key: key.name,
            timestamp: new Date().toISOString(),
          }),
        ),
    },
  },
});
