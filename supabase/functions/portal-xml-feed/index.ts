// Public XML feed for real estate portals (Zap/VivaReal/Imovelweb)
// Authenticated by an opaque integration_token tied to a profile (agency).
// Returns standardized <ListingDataFeed> XML for portal crawlers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlError(message: string, status: number): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Message>${esc(message)}</Message></Error>`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || !UUID_RE.test(token)) {
      return xmlError("Acesso negado: Token invalido", 403);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Resolve agency (profile) from token
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("integration_token", token)
      .maybeSingle();

    if (profileErr || !profile) {
      return xmlError("Acesso negado: Token invalido", 403);
    }

    // Fetch publishable properties with photos
    const { data: properties, error: propsErr } = await supabase
      .from("properties")
      .select(`
        id, code, nickname, description, address, city, state, zip_code, neighborhood,
        type, status, tipo_transacao, valor_aluguel, valor_venda,
        bedrooms, bathrooms, garages, area_total,
        publish_imovelweb, publish_zap,
        property_photos ( url, position )
      `)
      .eq("user_id", profile.id)
      .eq("status", "disponivel")
      .or("publish_imovelweb.eq.true,publish_zap.eq.true");

    if (propsErr) {
      console.error("[portal-xml-feed] query error", propsErr);
      return xmlError("Falha interna ao consultar imoveis", 500);
    }

    const items = (properties ?? []).map((p: any) => {
      const isSale = p.tipo_transacao === "Venda";
      const price = isSale ? p.valor_venda ?? 0 : p.valor_aluguel ?? p.rent_price ?? 0;
      const txType = isSale ? "For Sale" : "For Rent";
      const photos = ((p.property_photos ?? []) as Array<{ url: string; position: number }>)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((ph) => `        <Item url="${esc(ph.url)}" />`)
        .join("\n");

      return `    <Listing>
      <ListingID>${esc(p.code ?? p.id)}</ListingID>
      <Title>${esc(p.nickname ?? "")}</Title>
      <TransactionType>${txType}</TransactionType>
      <ListPrice currency="BRL">${esc(Number(price).toFixed(2))}</ListPrice>
      <PropertyType>${esc(p.type ?? "")}</PropertyType>
      <Details>
        <Bedrooms>${esc(p.bedrooms ?? 0)}</Bedrooms>
        <Bathrooms>${esc(p.bathrooms ?? 0)}</Bathrooms>
        <Garages>${esc(p.garages ?? 0)}</Garages>
        <TotalArea unit="m2">${esc(p.area_total ?? 0)}</TotalArea>
        <Description>${esc(p.description ?? "")}</Description>
      </Details>
      <Location>
        <Address>${esc(p.address ?? "")}</Address>
        <Neighborhood>${esc(p.neighborhood ?? "")}</Neighborhood>
        <City>${esc(p.city ?? "")}</City>
        <State>${esc(p.state ?? "")}</State>
        <PostalCode>${esc(p.zip_code ?? "")}</PostalCode>
      </Location>
      <Media>
${photos}
      </Media>
      <Portals>
        <Imovelweb>${p.publish_imovelweb ? "true" : "false"}</Imovelweb>
        <ZapVivaReal>${p.publish_zap ? "true" : "false"}</ZapVivaReal>
      </Portals>
    </Listing>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed>
  <Provider>NEXO</Provider>
  <Agency>${esc(profile.full_name ?? "")}</Agency>
  <GeneratedAt>${new Date().toISOString()}</GeneratedAt>
  <Listings>
${items}
  </Listings>
</ListingDataFeed>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        ...CORS,
      },
    });
  } catch (err) {
    console.error("[portal-xml-feed] unexpected", err);
    return xmlError("Falha interna inesperada", 500);
  }
});
