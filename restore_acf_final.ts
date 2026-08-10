
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function restoreAcfData() {
  console.log("Starting ACF data restoration...");
  
  const managers = [
    'bf05c6b3-2234-4b7f-8eb0-30c18cd2fe42',
    '8e1a48b2-9d41-4f20-b029-8e59e91503bc',
    '28bd485d-9f94-4500-bb70-d3e834222a79'
  ];

  // 1. Get all contract creations for these managers
  console.log("Fetching contract creation logs...");
  const { data: contractLogs, error: contractErr } = await supabaseAdmin
    .from('audit_logs')
    .select('metadata')
    .eq('action', 'contracts.create')
    .in('metadata->new->>user_id', managers);

  if (contractErr) {
    console.error("Error fetching contract logs:", contractErr);
    return;
  }

  console.log(`Found ${contractLogs.length} contract creation logs.`);

  let restoredContracts = 0;
  let restoredProperties = 0;
  let restoredInstallments = 0;

  for (const log of contractLogs) {
    const contractData = (log.metadata as any).new;
    const propertyId = contractData.property_id;
    const contractId = contractData.id;

    // A. Check if property exists
    const { data: existingProp } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .maybeSingle();

    if (!existingProp) {
      // We need to find property data. Let's assume for now properties were created 
      // but not audited. However, we have the property_id from the contract log.
      // Since we can't find property logs, we can't fully recreate the property 
      // unless we find where its data is. 
      // Wait! The user said "Imoveis ACF". Let's check if there are ANY properties for these managers now.
      continue;
    }

    // B. Restore Contract if missing
    const { data: existingContract } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .maybeSingle();

    if (!existingContract) {
      console.log(`Restoring contract ${contractId}...`);
      const { error: insErr } = await supabaseAdmin
        .from('contracts')
        .insert(contractData);
      
      if (!insErr) restoredContracts++;
      else console.error(`Failed to restore contract ${contractId}:`, insErr);
    }

    // C. Restore Installments for this contract
    const { data: installmentLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('metadata')
      .eq('action', 'installments.create')
      .eq('metadata->new->>contract_id', contractId);

    if (installmentLogs) {
      for (const instLog of installmentLogs) {
        const instData = (instLog.metadata as any).new;
        const { data: existingInst } = await supabaseAdmin
          .from('installments')
          .select('id')
          .eq('id', instData.id)
          .maybeSingle();
        
        if (!existingInst) {
          const { error: instInsErr } = await supabaseAdmin
            .from('installments')
            .insert(instData);
          if (!instInsErr) restoredInstallments++;
        }
      }
    }
  }

  console.log(`Restoration complete:
  - Contracts: ${restoredContracts}
  - Installments: ${restoredInstallments}
  - Properties: ${restoredProperties} (Note: property recreation skipped due to missing audit logs)`);
}

restoreAcfData();
