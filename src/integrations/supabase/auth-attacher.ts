import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = (createMiddleware() as any).middleware(async ({ next, request }: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  
  // Adiciona Correlation ID para rastreamento
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  headers["x-correlation-id"] = correlationId;

  return next({
    headers,
  });
}) as any;
