// Service layer + DTO público dos leads comerciais expostos pela API externa.
import { z } from "zod";

const PUBLIC_COLUMNS =
  "id, name, company_name, email, phone, city, state, managed_contracts, source, stage, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_page, referrer, created_at, updated_at";

const SORTABLE = ["created_at", "updated_at", "name"] as const;
export const MAX_LIMIT = 100;

export type ExternalLead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  managed_contracts: number;
  source: string;
  stage: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  referrer: string | null;
  created_at: string;
  updated_at: string;
};

/** DTO público — desacoplado do modelo do banco. */
export function toExternalLead(row: any): ExternalLead {
  return {
    id: row.id,
    name: row.name,
    company: row.company_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    managed_contracts: row.managed_contracts ?? 0,
    source: row.source,
    stage: row.stage,
    utm_source: row.utm_source ?? null,
    utm_medium: row.utm_medium ?? null,
    utm_campaign: row.utm_campaign ?? null,
    utm_content: row.utm_content ?? null,
    utm_term: row.utm_term ?? null,
    landing_page: row.landing_page ?? null,
    referrer: row.referrer ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(50),
  source: z.string().max(60).optional(),
  stage: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(160).optional(),
  created_from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  created_to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  sort: z.enum(SORTABLE).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const CreateLeadSchema = z.object({
  name: z.string().min(2).max(160),
  company: z.string().max(160).optional(),
  company_name: z.string().max(160).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().min(8).max(30).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(40).optional(),
  managed_contracts: z.coerce.number().int().min(0).max(1_000_000).optional(),
  source: z.string().max(60).optional(),
  stage: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  utm_content: z.string().max(120).optional(),
  utm_term: z.string().max(120).optional(),
  landing_page: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
});

export const UpdateLeadSchema = CreateLeadSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "No fields to update" },
);

function toRow(input: z.infer<typeof CreateLeadSchema>) {
  const { company, ...rest } = input;
  return {
    ...rest,
    ...(company !== undefined ? { company_name: company } : {}),
  };
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function listLeads(query: z.infer<typeof ListQuerySchema>) {
  const supabase = await db();
  const from = (query.page - 1) * query.limit;
  let q = supabase
    .from("marketing_leads")
    .select(PUBLIC_COLUMNS, { count: "exact" })
    .order(query.sort, { ascending: query.order === "asc" })
    .range(from, from + query.limit - 1);

  if (query.source) q = q.eq("source", query.source);
  if (query.stage) q = q.eq("stage", query.stage);
  if (query.phone) q = q.eq("phone", query.phone);
  if (query.email) q = q.ilike("email", query.email);
  if (query.created_from) q = q.gte("created_at", query.created_from);
  if (query.created_to) q = q.lte("created_at", query.created_to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    data: (data ?? []).map(toExternalLead),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getLead(id: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("marketing_leads")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toExternalLead(data) : null;
}

/** Retorna o id de um lead potencialmente duplicado (e-mail, telefone ou empresa). */
export async function findDuplicate(input: { email?: string; phone?: string; company?: string }) {
  const supabase = await db();
  const filters: string[] = [];
  if (input.email) filters.push(`email.ilike.${input.email}`);
  if (input.phone) filters.push(`phone.eq.${input.phone}`);
  if (input.company) filters.push(`company_name.ilike.${input.company}`);
  if (!filters.length) return null;

  const { data, error } = await supabase
    .from("marketing_leads")
    .select("id")
    .or(filters.join(","))
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function createLead(input: z.infer<typeof CreateLeadSchema>) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("marketing_leads")
    .insert(toRow(input))
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toExternalLead(data);
}

export async function updateLead(id: string, input: z.infer<typeof UpdateLeadSchema>) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("marketing_leads")
    .update(toRow(input as any))
    .eq("id", id)
    .select(PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toExternalLead(data) : null;
}
