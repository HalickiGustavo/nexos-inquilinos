import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { logSystemIncident } from "./lib/health.functions";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  
  try {
    return await next();
  } catch (error: any) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    
    console.error(`[Error ${correlationId}]`, error);
    
    // Log do incidente para o monitoramento externo (via audit_logs no banco)
    // Apenas para erros reais do servidor, não redirecionamentos ou 404s esperados
    try {
      await logSystemIncident({
        data: {
          service: "tanstack-start-main",
          severity: "high",
          operation: url.pathname,
          message: error?.message || "Unknown server error",
          correlationId,
          httpCode: 500
        }
      });
    } catch (logErr) {
      console.error("Failed to report incident to health API", logErr);
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));

