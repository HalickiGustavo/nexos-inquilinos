import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const completeRegistrationInput = z.object({
  email: z.string().email(),
  password: z.string(),
  fullName: z.string(),
  document: z.string(),
  phone: z.string(),
  role: z.enum(["manager", "owner"]),
  inviteToken: z.string().optional(),
  birthDate: z.string().optional(),
});

/**
 * Handles registration for both new and invited users.
 * For invited users (who might already exist in auth.users), it updates the existing record
 * and completes the setup, avoiding "user already exists" errors.
 */
export const completeRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => completeRegistrationInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { email, password, fullName, document, phone, role, inviteToken, birthDate } = data;

    // 1. Check if user already exists
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;

    if (existingUser) {
      // 2. Update existing user (invited flow)
      const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: true, // Auto-confirm if they were invited
          user_metadata: {
            full_name: fullName,
            role: role,
            document: document,
            phone: phone,
          },
        }
      );

      if (updateErr) throw new Error(`Erro ao atualizar usuário: ${updateErr.message}`);
      userId = updatedUser.user.id;
    } else {
      // 3. Create new user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // Standard sign-up requires verification
        user_metadata: {
          full_name: fullName,
          role: role,
          document: document,
          phone: phone,
        },
      });

      if (createErr) throw new Error(`Erro ao criar usuário: ${createErr.message}`);
      userId = newUser.user.id;
    }

    // 4. Update Profile (Upsert)
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email.toLowerCase(),
        full_name: fullName,
        document: document,
        phone: phone,
        birth_date: birthDate || null,
        updated_at: new Date().toISOString(),
      });

    if (profileErr) throw new Error(`Erro ao salvar perfil: ${profileErr.message}`);

    // 5. Handle Invite Token if present
    if (inviteToken && role === "owner") {
      const { data: invite } = await supabaseAdmin
        .from("landlord_invites")
        .select("*")
        .eq("invite_token", inviteToken)
        .eq("status", "pendente")
        .maybeSingle();

      if (invite) {
        // Assign landlord role (using upsert with id column which is primary key)
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "landlord" }, { onConflict: 'user_id,role' });

        // Mark invite as accepted
        await supabaseAdmin
          .from("landlord_invites")
          .update({
            status: "aceito",
            accepted_user_id: userId,
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invite.id);

        // Link properties if document matches
        const normDoc = document.replace(/\D/g, "");
        if (normDoc.length >= 11) {
          await supabaseAdmin
            .from("properties")
            .update({ landlord_id: userId })
            .eq("user_id", invite.manager_user_id)
            .is("landlord_id", null)
            .filter("notes", "ilike", `%${normDoc}%`);
        }
      }
    }

    // 6. Handle Manager role activation if imobiliaria
    if (role === "manager") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "manager" }, { onConflict: 'user_id,role' });
    }

    return { userId, email, fullName };
  });
