import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Integração Efí removida. Aguardando entrada do Stark Bank.
// Stubs mantidos para não quebrar componentes que ainda importam estas funções.

const inputSchema = z.object({ installmentId: z.string().uuid() });

const UNAVAILABLE_MSG =
  "Gerador de Pix temporariamente indisponível — migrando para Stark Bank.";

export type TripleSplitResult =
  | {
      ok: true;
      provider: "efi" | "mock";
      qrCodeBase64: string;
      pixPayload: string;
      breakdown: {
        total: number;
        nexo: number;
        agency: number;
        owner: number;
        nexoKey: string;
        agencyKey: string | null;
        ownerKey: string | null;
      };
    }
  | { ok: false; error: string; debug?: unknown };

export type BoletoResult =
  | {
      ok: true;
      provider: "efi" | "mock";
      url: string;
      barcode: string;
      pdfUrl: string;
      breakdown: { total: number; nexo: number; agency: number; owner: number };
    }
  | { ok: false; error: string };

export const generateTripleSplitPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async (): Promise<TripleSplitResult> => {
    return { ok: false, error: UNAVAILABLE_MSG };
  });

export const checkPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async (): Promise<{ paid: boolean; status?: string; error?: string }> => {
    return { paid: false };
  });

export const generateBoletoCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async (): Promise<BoletoResult> => {
    return { ok: false, error: UNAVAILABLE_MSG };
  });
