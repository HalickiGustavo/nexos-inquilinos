import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Registra um log de saúde do sistema de forma sanitizada.
 * Destinado a ser chamado pelo monitoramento externo ou middleware de erros.
 */
export const logSystemIncident = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    service: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    operation: z.string(),
    httpCode: z.number().optional(),
    duration: z.number().optional(),
    message: z.string(),
    correlationId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      
      // Sanitização básica para evitar exposição de segredos em metadados
      const sanitizedMetadata = data.metadata ? { ...data.metadata } : {};
      const sensitiveKeys = ["password", "token", "key", "secret", "cvv"];
      
      Object.keys(sanitizedMetadata).forEach(key => {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          sanitizedMetadata[key] = "[REDACTED]";
        }
      });

      const { error } = await supabaseAdmin.from("audit_logs").insert({
        action: `SYSTEM_INCIDENT_${data.severity.toUpperCase()}`,
        entity: data.service,
        entity_id: data.operation,
        metadata: {
          ...data,
          metadata: sanitizedMetadata
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("Failed to log system incident:", err);
      return { success: false };
    }
  });

/**
 * Health check leve para serviços individuais
 */
export const checkServiceHealth = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    service: z.enum(["supabase", "efi", "evolution", "auth"]),
  }).parse(data))
  .handler(async ({ data }) => {
    const start = Date.now();
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      
      if (data.service === "supabase") {
        const { error } = await supabaseAdmin.from("properties").select("id").limit(1);
        if (error) throw error;
      }
      
      if (data.service === "efi") {
        // Implementar check rápido se necessário
      }

      return { 
        status: "ok", 
        latency: Date.now() - start 
      };
    } catch (err: any) {
      return { 
        status: "error", 
        message: err.message,
        latency: Date.now() - start 
      };
    }
  });
