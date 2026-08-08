
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email(), password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = userList.users.find(u => u.email === data.email);
    if (!user) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password
    });
    
    if (error) throw error;
    return { success: true };
  });
