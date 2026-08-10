
import { supabaseAdmin } from './src/integrations/supabase/client.server';

const ACF_MANAGER_IDS = [
  '8e1a48b2-9d41-4f20-b029-8e59e91503bc', // ACF NEGOCIOS IMOBILIARIOS
  '28bd485d-9f94-4500-bb70-d3e834222a79', // André - Negócios Imobiliários
  'bf05c6b3-2234-4b7f-8eb0-30c18cd2fe42'  // TIAGO CATTO (imoveisacf@hotmail.com)
];

async function restoreACFData() {
  console.log('--- Iniciando Restauração de Dados ACF ---');
  
  // 1. Buscar logs de deleção de contratos dos gerentes ACF
  const { data: contractLogs, error: contractLogsError } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('entity', 'contracts')
    .eq('action', 'contracts.delete')
    .in("metadata->old->>'user_id'", ACF_MANAGER_IDS);

  if (contractLogsError) {
    console.error('Erro ao buscar logs de contratos:', contractLogsError);
    return;
  }

  console.log(`Encontrados ${contractLogs?.length || 0} contratos deletados nos logs.`);

  if (!contractLogs || contractLogs.length === 0) {
    console.log('Nenhum contrato encontrado para restaurar.');
    return;
  }

  let restoredContractsCount = 0;
  let skippedContractsCount = 0;
  let restoredInstallmentsCount = 0;

  for (const log of contractLogs) {
    const oldContract = log.metadata.old;
    const contractId = oldContract.id;

    // Verificar se o contrato já existe
    const { data: existingContract } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .single();

    if (existingContract) {
      console.log(`Contrato ${contractId} já existe. Pulando.`);
      skippedContractsCount++;
      continue;
    }

    // Verificar se o imóvel ainda existe (necessário para FK)
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', oldContract.property_id)
      .single();

    if (!property) {
      console.warn(`Imóvel ${oldContract.property_id} para o contrato ${contractId} não encontrado. Pulando restauração deste contrato.`);
      skippedContractsCount++;
      continue;
    }

    // Restaurar contrato
    const { error: insertContractError } = await supabaseAdmin
      .from('contracts')
      .insert(oldContract);

    if (insertContractError) {
      console.error(`Erro ao restaurar contrato ${contractId}:`, insertContractError);
      continue;
    }

    restoredContractsCount++;
    console.log(`Contrato ${contractId} restaurado com sucesso.`);

    // 2. Buscar e restaurar parcelas deste contrato
    const { data: installmentLogs, error: installmentLogsError } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity', 'installments')
      .eq('action', 'installments.delete')
      .eq("metadata->old->>'contract_id'", contractId);

    if (installmentLogsError) {
      console.error(`Erro ao buscar parcelas para o contrato ${contractId}:`, installmentLogsError);
      continue;
    }

    console.log(`Encontradas ${installmentLogs?.length || 0} parcelas para o contrato ${contractId}.`);

    for (const instLog of installmentLogs) {
      const oldInstallment = instLog.metadata.old;
      
      // Verificar se a parcela já existe
      const { data: existingInst } = await supabaseAdmin
        .from('installments')
        .select('id')
        .eq('id', oldInstallment.id)
        .single();

      if (existingInst) continue;

      const { error: insertInstError } = await supabaseAdmin
        .from('installments')
        .insert(oldInstallment);

      if (insertInstError) {
        console.error(`Erro ao restaurar parcela ${oldInstallment.id}:`, insertInstError);
      } else {
        restoredInstallmentsCount++;
      }
    }
  }

  console.log(`--- Fim da Restauração ---`);
  console.log(`Contratos restaurados: ${restoredContractsCount}`);
  console.log(`Contratos já existentes/pulados: ${skippedContractsCount}`);
  console.log(`Parcelas restauradas: ${restoredInstallmentsCount}`);

  // Registrar a restauração no log
  await supabaseAdmin.from('audit_logs').insert({
    action: 'restoration.acf',
    entity: 'system',
    metadata: {
      restored_contracts: restoredContractsCount,
      restored_installments: restoredInstallmentsCount,
      target_managers: ACF_MANAGER_IDS
    }
  });
}

restoreACFData().catch(console.error);
