// Server-only Asaas HTTP client. Never import from client code.
import process from "node:process";

export const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

export class AsaasError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

export async function asaasFetch<T = any>(
  path: string,
  init: RequestInit & { apiKey?: string } = {},
): Promise<T> {
  const apiKey = init.apiKey ?? process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      "User-Agent": "Nexo/1.0",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "errors" in data && Array.isArray((data as any).errors)
        ? (data as any).errors.map((e: any) => e.description).join("; ")
        : null) || `Asaas ${res.status}`;
    throw new AsaasError(res.status, data, msg);
  }
  return data as T;
}

export function getNexoFee(): number {
  const raw = process.env.ASAAS_NEXO_FEE ?? "24.99";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 24.99;
}

export function getNexoWalletId(): string | null {
  return process.env.ASAAS_NEXO_WALLET_ID || null;
}
