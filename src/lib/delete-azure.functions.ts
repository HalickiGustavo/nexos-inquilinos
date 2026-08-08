import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteAzureContracts = createServerFn({ method: "POST" })
  .handler(async () => {
    const email = 'azure.cosmeticos2025@gmail.com';
    const results: string[] = [];

    try {
      // 1. Get User ID
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
      if (userError) throw userError;
      
      const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      const userId = user?.id || '58c2cc03-cb13-4724-8ddb-77d7143cea96'; // Fallback to migration ID

      results.push(`Iniciando exclusão para: ${email} (${userId})`);

      // 2. Find all properties managed by this user
      const { data: properties } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('manager_id', userId);

      const propertyIds = properties?.map(p => p.id) || [];

      // 3. Delete installments and contracts linked to these properties
      if (propertyIds.length > 0) {
        const { error: instError } = await supabaseAdmin
          .from('installments')
          .delete()
          .filter('contract_id', 'in', `(${supabaseAdmin.from('contracts').select('id').filter('property_id', 'in', `(${propertyIds.join(',')})`).toString()})`);
        
        // Simpler approach: delete where property_id is in list for contracts first
        const { data: contractsToDelete } = await supabaseAdmin
          .from('contracts')
          .select('id')
          .filter('property_id', 'in', `(${propertyIds.join(',')})`);
        
        const contractIds = contractsToDelete?.map(c => c.id) || [];
        
        if (contractIds.length > 0) {
          await supabaseAdmin.from('installments').delete().in('contract_id', contractIds);
          await supabaseAdmin.from('contracts').delete().in('id', contractIds);
          results.push(`${contractIds.length} contratos deletados via manager_id`);
        }
      }

      // 4. Delete contracts directly linked via user_id
      const { data: directContracts } = await supabaseAdmin
        .from('contracts')
        .select('id')
        .eq('user_id', userId);

      const directIds = directContracts?.map(c => c.id) || [];
      if (directIds.length > 0) {
        await supabaseAdmin.from('installments').delete().in('contract_id', directIds);
        await supabaseAdmin.from('contracts').delete().in('id', directIds);
        results.push(`${directIds.length} contratos deletados via user_id`);
      }

      return { success: true, results };
    } catch (error: any) {
      console.error('Cleanup error:', error);
      return { success: false, error: error.message };
    }
  });
