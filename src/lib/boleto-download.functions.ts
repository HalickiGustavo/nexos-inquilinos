import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const downloadBoletoPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { installmentId: string }) => {
    if (!data?.installmentId || typeof data.installmentId !== "string") {
      throw new Error("installmentId obrigatório");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: inst, error } = await supabase
      .from("installments")
      .select("id, boleto_url")
      .eq("id", data.installmentId)
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Parcela não encontrada ou sem permissão");

    const boletoUrl = String(inst.boleto_url ?? "");
    if (!boletoUrl) throw new Error("Boleto ainda não gerado para esta parcela");

    const response = await fetch(boletoUrl);
    if (!response.ok) {
      throw new Error(`Não foi possível baixar o boleto (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, i + 8192);
      bin += String.fromCharCode(...chunk);
    }
    return { base64: btoa(bin), filename: `boleto-${inst.id}.pdf` };
  });
