import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteUserCompletely = createServerFn({ method: "POST" })
  .handler(async () => {
    const email = 'halickieduardo@gmail.com';
    const results: string[] = [];

    try {
      console.log(`[Admin] Iniciando limpeza total para ${email}`);
      
      // 1. Localizar no Auth
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (user) {
        const userId = user.id;
        results.push(`Usuário ID: ${userId}`);
        
        // 2. Roles
        const { error: roleErr } = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        results.push(roleErr ? `Erro roles: ${roleErr.message}` : "Roles removidas");

        // 3. Convites
        const { error: inviteErr } = await supabaseAdmin.from('landlord_invites').delete().eq('email', email);
        results.push(inviteErr ? `Erro convites: ${inviteErr.message}` : "Convites removidos");

        // 4. Deletar do Auth
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        results.push(delErr ? `Erro auth delete: ${delErr.message}` : "Usuário removido do Auth");
      } else {
        results.push("Usuário não encontrado no Auth");
      }

      // 5. Profile e outros dados por e-mail (caso existam sem conta auth ativa)
      const { error: profErr } = await supabaseAdmin.from('profiles').delete().eq('email', email);
      results.push(profErr ? `Erro profile: ${profErr.message}` : "Profile removido");

      console.log(`[Admin] Limpeza concluída: ${results.join(', ')}`);
      return { success: true, results };
    } catch (error: any) {
      console.error(`[Admin] Falha na limpeza: ${error.message}`);
      return { success: false, error: error.message };
    }
  });
