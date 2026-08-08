import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const setupInput = z.object({
  token: z.string(),
});

/**
 * Fetches invite details to pre-fill registration.
 * Allows safe verification of the token and retrieval of the invitee's email.
 */
export const getLandlordInviteDetails = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => setupInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from("landlord_invites")
      .select("email, full_name, document")
      .eq("invite_token", data.token)
      .eq("status", "pendente")
      .maybeSingle();

    if (error) throw new Error("Erro ao validar convite");
    if (!invite) throw new Error("Convite inválido, expirado ou já utilizado.");

    return {
      email: invite.email,
      fullName: invite.full_name,
      document: invite.document,
    };
  });
