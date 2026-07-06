// Proxy autenticado do PDF do boleto Stark Bank.
//
// A URL crua do Stark (`/boleto/:id/pdf`) exige ECDSA/Access-Signature em
// cada request. Um `<a target="_blank">` do navegador não consegue assinar
// — resulta em 401 para o inquilino. Aqui o servidor assina, busca os bytes
// e devolve como base64 para o cliente montar um `blob:` URL local.
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

    // 1) Verifica que o usuário tem acesso à parcela via RLS.
    const { data: inst, error } = await supabase
      .from("installments")
      .select("id, boleto_url")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Parcela não encontrada ou sem permissão");

    // Extrai o ID do boleto a partir do sufixo da URL Stark.
    let boletoId: string | null = null;
    if (inst.boleto_url) {
      const m = String(inst.boleto_url).match(/\/boleto\/([^/]+)\/pdf/);
      if (m) boletoId = m[1];
    }
    if (!boletoId) throw new Error("Boleto ainda não gerado para esta parcela");

    // 2) Servidor assina requisição Stark e busca bytes do PDF.
    const { starkFetchRaw } = await import("@/lib/stark/stark.server");
    const { bytes } = await starkFetchRaw({ path: `/boleto/${boletoId}/pdf` });

    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return { base64, filename: `boleto-${boletoId}.pdf` };
  });
