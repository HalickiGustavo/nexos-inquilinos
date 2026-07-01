// Stark Bank REST v2 client (fetch-based, ECDSA signed).
// Docs: https://starkbank.com/docs (v2)

import { Ecdsa, PrivateKey, PublicKey, Signature } from "starkbank-ecdsa";

const PROD_HOST = "https://api.starkbank.com/v2";
const SANDBOX_HOST = "https://sandbox.api.starkbank.com/v2";

function env() {
  const e = (process.env.STARK_ENVIRONMENT || "sandbox").toLowerCase();
  return e === "production" || e === "prod" ? "production" : "sandbox";
}

export function starkHost() {
  return env() === "production" ? PROD_HOST : SANDBOX_HOST;
}

export function isStarkConfigured() {
  return !!(process.env.STARK_PROJECT_ID && process.env.STARK_PRIVATE_KEY);
}

function getPrivateKey(): PrivateKey {
  const raw = process.env.STARK_PRIVATE_KEY;
  if (!raw) throw new Error("STARK_PRIVATE_KEY not set");
  return PrivateKey.fromPem(raw);
}

function unixTime() {
  return Math.floor(Date.now() / 1000).toString();
}

export type StarkRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

export async function starkFetch<T = any>(opts: StarkRequestOptions): Promise<T> {
  if (!isStarkConfigured()) {
    throw new Error("Stark Bank não configurado (defina STARK_PROJECT_ID e STARK_PRIVATE_KEY)");
  }
  const method = opts.method ?? "GET";
  const projectId = process.env.STARK_PROJECT_ID!;
  const accessId = `project/${projectId}`;
  const accessTime = unixTime();

  let url = `${starkHost()}${opts.path}`;
  if (opts.query) {
    const qs = Object.entries(opts.query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const bodyStr = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const message = `${accessId}:${accessTime}:${bodyStr}`;
  const signature = Ecdsa.sign(message, getPrivateKey()).toBase64();

  const headers: Record<string, string> = {
    "Access-Id": accessId,
    "Access-Time": accessTime,
    "Access-Signature": signature,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Nexo/1.0 (StarkFetch)",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.message || `Stark HTTP ${res.status}`;
    const err = new Error(`[stark] ${method} ${opts.path} → ${res.status}: ${msg}`) as any;
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

// ---------------- Webhook signature verification ----------------
// Stark envia header "Digital-Signature" (base64) sobre o body cru.
// Chave pública Stark é retornada em GET /public-key (uma vez, cacheado).

let cachedPublicKey: PublicKey | null = null;
export async function getStarkPublicKey(): Promise<PublicKey> {
  if (cachedPublicKey) return cachedPublicKey;
  const data = await starkFetch<{ publicKeys: Array<{ content: string }> }>({
    method: "GET",
    path: "/public-key",
    query: { limit: 1 },
  });
  const pem = data?.publicKeys?.[0]?.content;
  if (!pem) throw new Error("stark public key not returned");
  cachedPublicKey = PublicKey.fromPem(pem);
  return cachedPublicKey;
}

export async function verifyStarkSignature(
  rawBody: string,
  signatureBase64: string | null | undefined,
): Promise<boolean> {
  if (!signatureBase64) return false;
  try {
    const pub = await getStarkPublicKey();
    const sig = Signature.fromBase64(signatureBase64);
    return Ecdsa.verify(rawBody, sig, pub);
  } catch (e) {
    console.error("[stark] signature verify error", e);
    return false;
  }
}
