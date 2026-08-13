// Server-only helper to send a WhatsApp text.
// Currently using WAHA as the primary gateway.
import { sendWahaText, type WahaSendResult } from "./waha.server";

export type WhatsAppSendResult = WahaSendResult;

export { sanitizeBrPhone } from "./waha.server";

export async function sendWhatsAppText(params: {
  phone: string;
  text: string;
  templateId?: string;
  variables?: Record<string, string>;
  instance?: string; // Maps to session in WAHA
}): Promise<WhatsAppSendResult> {
  // We keep the signature compatible but call WAHA
  return sendWahaText({
    phone: params.phone,
    text: params.text,
    session: params.instance
  });
}

/** @deprecated Use sendWhatsAppText */
export const sendEvolutionText = sendWhatsAppText;

