
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function cleanupUser(email: string) {
  console.log(`Iniciando limpeza para: ${email}`);
  
  // 1. Encontrar o usuário no auth
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;
  
  const targetUsers = users.filter(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (targetUsers.length === 0) {
    console.log(`Nenhum usuário encontrado com o email ${email}`);
    return;
  }
  
  console.log(`Encontrados ${targetUsers.length} usuários.`);
  
  for (const user of targetUsers) {
    console.log(`Limpando usuário ID: ${user.id}`);
    
    // As deleções em cascata no banco (profiles, roles, etc) devem ser tratadas pelas FKs com ON DELETE CASCADE
    // Mas vamos garantir que removemos o user do auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`Erro ao deletar usuário ${user.id}:`, deleteError);
    } else {
      console.log(`Usuário ${user.id} deletado com sucesso.`);
    }
  }
}

async function run() {
  try {
    await cleanupUser("halickieduardo@gmail.com");
    console.log("Limpeza concluída.");
  } catch (err) {
    console.error("Erro fatal na limpeza:", err);
  }
}

run();
