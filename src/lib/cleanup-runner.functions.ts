import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const executeCleanup = createServerFn({ method: "POST" })
  .handler(async () => {
    const email = 'halickieduardo@gmail.com';
    const results: string[] = [];

    try {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (user) {
        const userId = user.id;
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        results.push("Roles removidas");

        await supabaseAdmin.from('landlord_invites').delete().eq('email', email);
        results.push("Convites removidos");

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        results.push(delErr ? `Erro auth delete: ${delErr.message}` : "Usuário removido do Auth");
      } else {
        results.push("Usuário não encontrado no Auth");
      }

      await supabaseAdmin.from('profiles').delete().eq('email', email);
      results.push("Profile removido");

      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
