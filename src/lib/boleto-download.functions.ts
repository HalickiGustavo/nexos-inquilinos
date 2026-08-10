// Proxy autenticado do PDF do boleto.
//
// A URL crua do Stark legado (`/boleto/:id/pdf`) exige ECDSA/Access-Signature em
// cada request. Um `<a target="_blank">` do navegador não consegue assinar
// — resulta em 401 para o inquilino. A Efí devolve URL pública; quando essa URL
// existir, o servidor apenas baixa os bytes e devolve base64 para download.
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

    const boletoUrl = String(inst.boleto_url ?? "");
    if (!boletoUrl) throw new Error("Boleto ainda não gerado para esta parcela");

    // Efí: URL pública direta do PDF.
    if (!/\/boleto\/[^/]+\/pdf(?:$|[?#])/.test(boletoUrl)) {
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
    }

    // Extrai o ID do boleto a partir do sufixo da URL Stark.
    let boletoId: string | null = null;
    const m = boletoUrl.match(/\/boleto\/([^/]+)\/pdf/);
    if (m) boletoId = m[1];
    if (!boletoId) throw new Error("Boleto ainda não gerado para esta parcela");

    throw new Error("Download de boletos Stark legados não é mais suportado.");
    // 2) Servidor assina requisição Stark e busca bytes do PDF.

    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return { base64, filename: `boleto-${boletoId}.pdf` };
  });
