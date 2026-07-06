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
      .select("id, stark_boleto_id, boleto_url")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inst) throw new Error("Parcela não encontrada ou sem permissão");

    // Extrai o ID do boleto: coluna dedicada OU sufixo da boleto_url.
    let boletoId: string | null = (inst as any).stark_boleto_id ?? null;
    if (!boletoId && inst.boleto_url) {
      const m = String(inst.boleto_url).match(/\/boleto\/([^/]+)\/pdf/);
      if (m) boletoId = m[1];
    }
    if (!boletoId) throw new Error("Boleto ainda não gerado para esta parcela");

    // 2) Assina requisição Stark e busca bytes do PDF.
    const [{ starkHost, isStarkConfigured, normalizeStarkAccessId, getPrivateKey }, ecdsa] =
      await Promise.all([
        import("@/lib/stark/stark.server"),
        import("starkbank-ecdsa"),
      ]);
    if (!isStarkConfigured()) throw new Error("Stark Bank não configurado");
    const Ecdsa = (ecdsa as any).Ecdsa;

    const accessId = normalizeStarkAccessId(process.env.STARK_PROJECT_ID || "");
    const accessTime = Math.floor(Date.now() / 1000).toString();
    const path = `/boleto/${boletoId}/pdf`;
    const message = `${accessId}:${accessTime}:`;
    const signature = Ecdsa.sign(message, getPrivateKey()).toBase64();

    const res = await fetch(`${starkHost()}${path}`, {
      method: "GET",
      headers: {
        "Access-Id": accessId,
        "Access-Time": accessTime,
        "Access-Signature": signature,
        Accept: "application/pdf",
        "User-Agent": "Nexo/1.0 (BoletoProxy)",
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Stark ${res.status}: ${txt.slice(0, 200)}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const base64 = btoa(bin);
    return { base64, filename: `boleto-${boletoId}.pdf` };
  });
