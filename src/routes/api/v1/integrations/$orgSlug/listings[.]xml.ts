// Unified XML feed for portals — resolves org by clean slug instead of raw token.
// Maps /api/v1/integrations/[org-slug]/listings.xml → manager_user_id, then
// generates the same Zap/VivaReal-standard XML produced by /api/public/listings.xml.
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

export const Route = createFileRoute("/api/v1/integrations/$orgSlug/listings.xml")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        try {
          const slug = String(params.orgSlug ?? "").toLowerCase();
          if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
            return xmlResponse(
              `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Identificador invalido.</Mensagem></Error>`,
              400,
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: agency } = await supabaseAdmin
            .from("agency_settings")
            .select("manager_user_id")
            .eq("org_slug", slug)
            .maybeSingle();

          if (!agency?.manager_user_id) {
            return xmlResponse(
              `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Integracao nao encontrada.</Mensagem></Error>`,
              404,
            );
          }

          const managerId = agency.manager_user_id as string;

          const { data: properties, error } = await supabaseAdmin
            .from("properties")
            .select(`
              id, code, nickname, description, address, city, state, zip_code, neighborhood,
              type, status, tipo_transacao, valor_aluguel, valor_venda, rent_price, condo_fee, iptu,
              bedrooms, bathrooms, garages, area_total,
              property_photos ( url, position )
            `)
            .eq("user_id", managerId)
            .eq("status", "disponivel")
            .or("publish_imovelweb.eq.true,publish_zap.eq.true");

          if (error) {
            console.error("[v1.listings.xml] query error", error);
            return xmlResponse(
              `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Falha interna ao gerar o feed.</Mensagem></Error>`,
              500,
            );
          }

          const SIGN_TTL = 60 * 60 * 24 * 7;
          const imoveis = await Promise.all(
            (properties ?? []).map(async (p: any) => {
              const { data: files } = await supabaseAdmin.storage
                .from("property-images")
                .list(p.id, { limit: 100, sortBy: { column: "name", order: "asc" } });

              const bucketPaths = (files ?? [])
                .filter((f) => f.name && !f.name.startsWith("."))
                .map((f) => `${p.id}/${f.name}`);

              let photoUrls: string[] = [];
              if (bucketPaths.length > 0) {
                const { data: signed } = await supabaseAdmin.storage
                  .from("property-images")
                  .createSignedUrls(bucketPaths, SIGN_TTL);
                photoUrls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
              }

              if (photoUrls.length === 0) {
                const dbRows = ((p.property_photos ?? []) as Array<{ url: string; position: number }>)
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                photoUrls = dbRows.map((r) => r.url).filter(Boolean);
              }

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
<Imoveis provider="NEXO" org="${esc(slug)}" geradoEm="${new Date().toISOString()}">
${imoveis.join("\n")}
</Imoveis>`;
          return xmlResponse(xml);
        } catch (err) {
          console.error("[v1.listings.xml] unexpected", err);
          return xmlResponse(
            `<?xml version="1.0" encoding="utf-8"?>\n<Error><Mensagem>Erro inesperado.</Mensagem></Error>`,
            500,
          );
        }
      },
    },
  },
});
