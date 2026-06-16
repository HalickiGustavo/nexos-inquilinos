// Server-only audit log helper. Writes to public.audit_logs via service role
// so entries cannot be tampered with by RLS-bound clients.
import { getRequest, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type AuditEntry = {
  userId: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      // getRequest only works inside a server request scope
      getRequest();
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch {
      // no request context — leave nulls
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      user_id: entry.userId,
      user_email: entry.userEmail ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      ip_address: ip,
      user_agent: ua,
      metadata: (entry.metadata ?? {}) as any,
    });
  } catch (e) {
    // Auditing must never break the main flow.
    console.warn("[audit] failed to record entry:", (e as any)?.message);
  }
}
