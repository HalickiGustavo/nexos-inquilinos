import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runTest() {
  console.log("--- TEST PAYMENT FLOW (V5 - FINAL FIX) ---");

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

  // 2. Garantir Perfil do Proprietário com Chave PIX (Eduardo)
  await supabase.from('profiles').upsert({
    id: landlordId,
    full_name: 'Eduardo Halicki',
    pix_key: '05003942966',
    pix_key_type: 'cpf'
  });

  // 3. Garantir Configuração da Imobiliária (Azure)
  await supabase.from('agency_settings').upsert({
    manager_user_id: managerId,
    agency_pix_key: 'h2memorialle@gmail.com',
    agency_pix_key_type: 'email'
  });

  // 4. Criar Imovel (rent_price, nickname)
  const { data: property, error: pErr } = await supabase.from('properties').insert({
    nickname: 'Imovel Teste Payout ' + Date.now(),
    address: 'Rua do Sucesso, 777',
    landlord_id: landlordId,
    rent_price: 50.25,
    user_id: managerId,
    default_management_fee_percent: 10
  }).select().single();
  if (pErr) throw pErr;

  // 5. Criar Contrato
  const { data: contract } = await supabase.from('contracts').insert({
    property_id: property!.id,
    tenant_id: tenant!.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    due_day: 5,
    rent_amount: 50.25,
    active: true
  }).select().single();

  // 6. Parcela
  const { data: installment } = await supabase.from('installments').insert({
    contract_id: contract!.id,
    description: 'Parcela Teste Payout',
    amount: 50.25,
    due_date: '2026-08-05',
    status: 'pendente'
  }).select().single();

  console.log("Massa criada. ID Parcela:", installment!.id);

  // 7. Simular Recebimento e Split (Efí Flow)
  console.log("Simulando split manual (enqueueSplitForInstallment)...");
  const { enqueueSplitForInstallment } = await import('./src/lib/efi/webhook.server');
  // 50.25 aluguel + 24.99 Nexo Fee = 75.24 total pago (ou simulado)
  const totalPago = 50.25 + 24.99;
  await enqueueSplitForInstallment(installment!.id, totalPago);

  // 8. Rodar o Worker de Payout
  console.log("Rodando Payout Worker...");
  const { runEfiPayoutWorker } = await import('./src/lib/efi/payout-worker.server');
  const result = await runEfiPayoutWorker({ limit: 10 });
  
  console.log("Resultado Worker:", JSON.stringify(result, null, 2));

  // 9. Verificar status final
  const { data: finalTransfers } = await supabase.from('payment_transfers')
    .select('id, status, error_message, recipient_type, amount, pix_key')
    .eq('installment_id', installment!.id);
    
  console.log("Status Final dos Repasses:");
  finalTransfers?.forEach(t => {
    console.log(`- Recipient: ${t.recipient_type}, Amount: ${t.amount}, Key: ${t.pix_key}, Status: ${t.status}, Error: ${t.error_message || 'None'}`);
  });
}

runTest().catch(console.error);
