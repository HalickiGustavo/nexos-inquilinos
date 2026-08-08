import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runTest() {
  console.log("--- TEST PAYMENT FLOW ---");

  // Usar IDs fixos para garantir consistência
  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; 
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; 
  const tenantUserId = '9db43155-2dfd-4416-9fae-1dec2589b8d7';

  // 1. Garantir Tenant
  const { data: tenant } = await supabase.from('tenants').upsert({
    user_id: tenantUserId,
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061',
    phone: '11999999999'
  }).select().single();

  // 2. Criar Imovel (Removendo manager_user_id)
  const { data: property } = await supabase.from('properties').insert({
    title: 'Imovel Teste Pagamento',
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    price: 50.25,
    user_id: managerId // Usando user_id como dono/criador
  }).select().single();

  if (!property) throw new Error("Falha ao criar imóvel");

  // 3. Criar Contrato
  const { data: contract } = await supabase.from('contracts').insert({
    property_id: property.id,
    tenant_id: tenant!.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    due_day: 5,
    rent_amount: 50.25,
    active: true
  }).select().single();

  if (!contract) throw new Error("Falha ao criar contrato");

  // 4. Criar Parcela
  const { data: installment } = await supabase.from('installments').insert({
    contract_id: contract.id,
    description: 'Primeira Parcela',
    amount: 50.25,
    due_date: '2026-08-05',
    status: 'pendente'
  }).select().single();

  if (!installment) throw new Error("Falha ao criar parcela");

  console.log("Massa de teste criada. ID Parcela:", installment.id);

  // 5. Simular Pagamento (Marcar como PAGO para disparar os splits)
  console.log("Simulando pagamento...");
  const { error: payErr } = await supabase.from('installments').update({
    status: 'pago',
    paid_at: new Date().toISOString()
  }).eq('id', installment.id);

  if (payErr) throw payErr;

  // 6. Verificar se os payment_transfers foram criados (disparado por trigger/hook se existir)
  // Nota: O sistema parece usar `src/lib/pix-split.functions.ts` manualmente ou via server function.
  // Vou rodar o split manual se necessário, mas primeiro vejo se o hook disparou.
  
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: transfers } = await supabase.from('payment_transfers').select('*').eq('installment_id', installment.id);
  
  if (!transfers || transfers.length === 0) {
    console.log("Transfers não encontrados. Rodando split manual...");
    const { splitInstallmentPayment } = await import('./src/lib/pix-split.functions');
    await splitInstallmentPayment(installment.id, managerId);
  }

  const { data: finalTransfers } = await supabase.from('payment_transfers').select('*').eq('installment_id', installment.id);
  console.log("Transfers criados:", finalTransfers?.length);

  // 7. Rodar o Worker de Payout
  console.log("Rodando Payout Worker...");
  const { runEfiPayoutWorker } = await import('./src/lib/efi/payout-worker.server');
  const result = await runEfiPayoutWorker({ limit: 5 });
  
  console.log("Resultado Worker:", JSON.stringify(result, null, 2));

  // 8. Verificar logs de erro se falhou
  const { data: logs } = await supabase.from('payment_transfers').select('id, status, error_message, recipient_type').eq('installment_id', installment.id);
  console.log("Status Final dos Repasses:", JSON.stringify(logs, null, 2));
}

runTest().catch(console.error);
