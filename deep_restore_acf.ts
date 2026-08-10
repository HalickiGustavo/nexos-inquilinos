
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function deepRestoreAcf() {
  console.log("Starting Deep ACF Restoration...");
  
  const managers = [
    'bf05c6b3-2234-4b7f-8eb0-30c18cd2fe42',
    '8e1a48b2-9d41-4f20-b029-8e59e91503bc',
    '28bd485d-9f94-4500-bb70-d3e834222a79'
  ];

  // 1. Get all contract deletion logs for these managers
  console.log("Fetching contract deletion logs...");
  const { data: contractLogs, error: contractErr } = await supabaseAdmin
    .from('audit_logs')
    .select('metadata')
    .eq('action', 'contracts.delete')
    .in('metadata->old->>user_id', managers);

  if (contractErr) {
    console.error("Error fetching logs:", contractErr);
    return;
  }

  console.log(`Found ${contractLogs.length} contracts to analyze.`);

  let restoredContracts = 0;
  let restoredInstallments = 0;
  let missingProperties = new Set();
  let missingTenants = new Set();

  for (const log of contractLogs) {
    const contractData = (log.metadata as any).old;
    const propertyId = contractData.property_id;
    const tenantId = contractData.tenant_id;
    const contractId = contractData.id;

    // Check property
    const { data: prop } = await supabaseAdmin.from('properties').select('id').eq('id', propertyId).maybeSingle();
    if (!prop) {
      missingProperties.add(propertyId);
      continue;
    }

    // Check tenant
    const { data: tenant } = await supabaseAdmin.from('profiles').select('id').eq('id', tenantId).maybeSingle();
    if (!tenant) {
      missingTenants.add(tenantId);
      continue;
    }

    // Restore contract
    const { data: existingContract } = await supabaseAdmin.from('contracts').select('id').eq('id', contractId).maybeSingle();
    if (!existingContract) {
      console.log(`Restoring Contract ${contractId}...`);
      const { error: insErr } = await supabaseAdmin.from('contracts').insert(contractData);
      if (insErr) {
        console.error(`Error restoring contract ${contractId}:`, insErr);
        continue;
      }
      restoredContracts++;
    }

    // Restore installments
    const { data: instLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('metadata')
      .eq('action', 'installments.delete')
      .eq('metadata->old->>contract_id', contractId);
    
    if (instLogs) {
      for (const instLog of instLogs) {
        const instData = (instLog.metadata as any).old;
        const { data: existingInst } = await supabaseAdmin.from('installments').select('id').eq('id', instData.id).maybeSingle();
        if (!existingInst) {
          const { error: instErr } = await supabaseAdmin.from('installments').insert(instData);
          if (!instErr) restoredInstallments++;
        }
      }
    }
  }

  console.log(`Summary:
  - Restored Contracts: ${restoredContracts}
  - Restored Installments: ${restoredInstallments}
  - Missing Properties: ${missingProperties.size}
  - Missing Tenants: ${missingTenants.size}`);
}

deepRestoreAcf();
