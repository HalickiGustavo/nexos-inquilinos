import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ensures that if a user registers via an invite, their profile name/email 
 * matches the invite record. This is useful when the manager corrected 
 * the name/email in the invitation list.
 */
export const syncInviteToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Look for a matching invite for this email
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("landlord_invites")
      .select("full_name, document, status")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();

    if (inviteErr) {
      console.error("[sync] Error fetching invite:", inviteErr);
      return { ok: false };
    }

    if (!invite) {
      return { ok: true, synced: false, reason: "no_invite" };
    }

    // 2. Update the profile with the invite data if it's more complete/updated
    // We only update if status is pendente or we just accepted it
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: invite.full_name,
        document: invite.document,
      })
      .eq("id", userId);

    if (updateErr) {
      console.error("[sync] Error updating profile:", updateErr);
      return { ok: false };
    }

    // 3. Mark invite as accepted if it was pending
    if (invite.status === "pendente") {
      await supabaseAdmin
        .from("landlord_invites")
        .update({ status: "aceito" })
        .eq("email", data.email.toLowerCase().trim());
    }

    return { ok: true, synced: true };
  });
