// Emite Boleto Stark sob demanda para uma parcela, verificando
// que o usuário autenticado (inquilino) tem acesso à parcela via RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestBoletoForInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { installmentId: string }) => {
    if (!data?.installmentId || typeof data.installmentId !== "string") {
      throw new Error("installmentId obrigatório");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS garante que o caller enxerga apenas parcelas às quais tem acesso.
    const { data: inst, error } = await supabase
      .from("installments")
      .select("id, status")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Parcela não encontrada ou sem permissão");
    if (inst.status === "pago") throw new Error("Parcela já paga");

    const { issueBoletoForInstallmentEfi } = await import(
      "@/lib/efi/boleto-issuer.server"
    );
    const res = await issueBoletoForInstallmentEfi(data.installmentId);
    if (!res.ok) throw new Error(res.error);
    return { ok: true, alreadyExisted: res.alreadyExisted, pdfUrl: res.pdfUrl };
  });
