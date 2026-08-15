import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const LogEventSchema = z.object({
  eventType: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  service: z.string(),
  endpoint: z.string().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  stackTrace: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

/**
 * Structural Monitoring: Log system events to the database.
 */
export const logSystemEvent = createServerFn({ method: "POST" })
  .inputValidator((data) => LogEventSchema.parse(data))
  .handler(async ({ data }) => {
    const { error } = await (supabase.from('system_health_logs' as any) as any).insert({
      event_type: data.eventType,
      severity: data.severity,
      service: data.service,
      endpoint: data.endpoint || null,
      error_message: data.errorMessage || null,
      error_code: data.errorCode || null,
      stack_trace: data.stackTrace || null,
      metadata: data.metadata || {},
      tenant_id: data.tenantId || null,
      user_id: data.userId || null,
      status: 'detected'
    });

    if (error) {
      console.error("[monitoring] Failed to log event:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  });

export const getSystemStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const [logsResult, activeIncidentsResult] = await Promise.all([
      (supabase.from('system_health_logs' as any) as any).select('*').order('created_at', { ascending: false }).limit(50),
      (supabase.from('system_health_logs' as any) as any).select('id', { count: 'exact', head: true }).neq('status', 'resolved').eq('severity', 'critical')
    ]);

    return {
      logs: (logsResult.data as any[]) || [],
      criticalIncidentsCount: (activeIncidentsResult.count as number) || 0,
      timestamp: new Date().toISOString()
    };
  });
