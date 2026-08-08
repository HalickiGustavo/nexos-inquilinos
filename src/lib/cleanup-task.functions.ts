import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteUserCompletely = createServerFn({ method: "POST" })
  .handler(async () => {
    const email = 'halickieduardo@gmail.com';
    const results: string[] = [];

    try {
      // 1. Listar usuários para encontrar o ID
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (user) {
        const userId = user.id;
        
        // 2. Remover roles
        const { error: roleErr } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        results.push(roleErr ? `Erro roles: ${roleErr.message}` : "Roles removidas");

        // 3. Remover convites
        const { error: inviteErr } = await supabaseAdmin
          .from('landlord_invites')
          .delete()
          .eq('email', email);
        results.push(inviteErr ? `Erro convites: ${inviteErr.message}` : "Convites removidos");

        // 4. Deletar do Auth
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        results.push(delErr ? `Erro auth delete: ${delErr.message}` : "Usuário removido do Auth");
      } else {
        results.push("Usuário não encontrado no Auth");
      }

      // 5. Garantir remoção do profile
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('email', email);
      results.push(profErr ? `Erro profile: ${profErr.message}` : "Profile removido");

      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
