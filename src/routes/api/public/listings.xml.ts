// Feed XML público no padrão Zap/VivaReal.
// Endpoint não autenticado: portais externos (Zap, VivaReal, OLX, Imovelweb)
// consomem este feed periodicamente. URLs de imagens são permanentes via
// bucket público `property-images` (`.getPublicUrl()`).
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      ...CORS,
    },
  });
}

export const Route = createFileRoute("/api/public/listings.xml")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const supabaseUrl = process.env.SUPABASE_URL!;

          // Imóveis ativos / disponíveis
          const { data: properties, error } = await supabaseAdmin
            .from("properties")
            .select(`
              id, code, nickname, description, address, city, state, zip_code, neighborhood,
              type, status, tipo_transacao, valor_aluguel, valor_venda, rent_price, condo_fee, iptu,
              bedrooms, bathrooms, garages, area_total,
              property_photos ( url, position )
            `)
            .eq("status", "disponivel");

          if (error) {
            console.error("[listings.xml] erro ao consultar imóveis:", error);
            return xmlResponse(
              `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Falha interna ao gerar o feed.</Mensagem></Error>`,
              500,
            );
          }

          const imoveis = await Promise.all(
            (properties ?? []).map(async (p: any) => {
              // Lista arquivos no folder = property.id dentro do bucket público
              const { data: files } = await supabaseAdmin.storage
                .from("property-images")
                .list(p.id, { limit: 100, sortBy: { column: "name", order: "asc" } });

              const bucketPhotos = (files ?? [])
                .filter((f) => f.name && !f.name.startsWith("."))
                .map((f) => {
                  const { data } = supabaseAdmin.storage
                    .from("property-images")
                    .getPublicUrl(`${p.id}/${f.name}`);
                  return data.publicUrl;
                });

              // Fallback: URLs já registradas em property_photos
              const dbPhotos = ((p.property_photos ?? []) as Array<{ url: string; position: number }>)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((ph) => ph.url)
                .filter(Boolean);

              const photoUrls = bucketPhotos.length > 0 ? bucketPhotos : dbPhotos;

              const fotosXml = photoUrls
                .map(
                  (url, idx) => `      <Foto>
        <URL>${esc(url)}</URL>
        <Principal>${idx === 0 ? "true" : "false"}</Principal>
        <Ordenacao>${idx + 1}</Ordenacao>
      </Foto>`,
                )
                .join("\n");

              const isSale = p.tipo_transacao === "Venda";
              const preco = isSale
                ? Number(p.valor_venda ?? 0)
                : Number(p.valor_aluguel ?? p.rent_price ?? 0);
              const tipoNegocio = isSale ? "Venda" : "Locacao";

              return `  <Imovel>
    <CodigoImovel>${esc(p.code ?? p.id)}</CodigoImovel>
    <TituloImovel>${esc(p.nickname ?? "")}</TituloImovel>
    <TipoImovel>${esc(p.type ?? "")}</TipoImovel>
    <TipoOferta>${tipoNegocio}</TipoOferta>
    <PrecoVenda>${isSale ? preco.toFixed(2) : "0.00"}</PrecoVenda>
    <PrecoLocacao>${!isSale ? preco.toFixed(2) : "0.00"}</PrecoLocacao>
    <PrecoCondominio>${Number(p.condo_fee ?? 0).toFixed(2)}</PrecoCondominio>
    <PrecoIPTU>${Number(p.iptu ?? 0).toFixed(2)}</PrecoIPTU>
    <QtdDormitorios>${Number(p.bedrooms ?? 0)}</QtdDormitorios>
    <QtdBanheiros>${Number(p.bathrooms ?? 0)}</QtdBanheiros>
    <QtdVagas>${Number(p.garages ?? 0)}</QtdVagas>
    <AreaUtil>${Number(p.area_total ?? 0)}</AreaUtil>
    <Observacao>${esc(p.description ?? "")}</Observacao>
    <Endereco>${esc(p.address ?? "")}</Endereco>
    <Bairro>${esc(p.neighborhood ?? "")}</Bairro>
    <Cidade>${esc(p.city ?? "")}</Cidade>
    <UF>${esc(p.state ?? "")}</UF>
    <CEP>${esc(p.zip_code ?? "")}</CEP>
    <Fotos>
${fotosXml}
    </Fotos>
  </Imovel>`;
            }),
          );

          const xml = `<?xml version="1.0" encoding="utf-8"?>
<Imoveis xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" provider="NEXO" geradoEm="${new Date().toISOString()}" url="${esc(supabaseUrl)}">
${imoveis.join("\n")}
</Imoveis>`;

          return xmlResponse(xml);
        } catch (err) {
          console.error("[listings.xml] exceção inesperada:", err);
          return xmlResponse(
            `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Erro inesperado ao gerar o feed.</Mensagem></Error>`,
            500,
          );
        }
      },
    },
  },
});
