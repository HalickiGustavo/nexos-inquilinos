import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runTest() {
  console.log("--- TEST PAYMENT FLOW (V3) ---");

  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; 
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; 
  const tenantUserId = '9db43155-2dfd-4416-9fae-1dec2589b8d7';

  // 1. Garantir Tenant
  const { data: tenant, error: tErr } = await supabase.from('tenants').upsert({
    user_id: tenantUserId,
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061',
    phone: '11999999999'
  }).select().single();
  if (tErr) console.error("T Error:", tErr);

  // 2. Criar Imovel com colunas mínimas
  const { data: property, error: pErr } = await supabase.from('properties').insert({
    title: 'Imovel Teste ' + Date.now(),
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    price: 50.25
  }).select().single();
  if (pErr) console.error("P Error:", pErr);

  const activeProp = property;
  if (!activeProp) throw new Error("Falha ao criar imóvel");

  // 3. Criar Contrato
  const { data: contract, error: cErr } = await supabase.from('contracts').insert({
    property_id: activeProp.id,
    tenant_id: tenant!.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    due_day: 5,
    rent_amount: 50.25,
    active: true
  }).select().single();
  if (cErr) console.error("C Error:", cErr);

  // 4. Parcela
  const { data: installment, error: iErr } = await supabase.from('installments').insert({
    contract_id: contract!.id,
    description: 'Primeira Parcela',
    amount: 50.25,
    due_date: '2026-08-05',
    status: 'pendente'
  }).select().single();
  if (iErr) console.error("I Error:", iErr);

  console.log("Parcela ID:", installment!.id);

  // 5. Simular split manual
  console.log("Simulando split manual...");
  const { splitInstallmentPayment } = await import('./src/lib/pix-split.functions');
  await splitInstallmentPayment(installment!.id, managerId);

  // 6. Rodar o Worker de Payout
  console.log("Rodando Payout Worker...");
  const { runEfiPayoutWorker } = await import('./src/lib/efi/payout-worker.server');
  const result = await runEfiPayoutWorker({ limit: 10 });
  console.log("Resultado Worker:", JSON.stringify(result, null, 2));

  // 7. Verificar status final
  const { data: finalTransfers } = await supabase.from('payment_transfers')
    .select('id, status, error_message, recipient_type, amount')
    .eq('installment_id', installment!.id);
    
  console.log("Status Final dos Repasses:");
  finalTransfers?.forEach(t => {
    console.log(`- Recipient: ${t.recipient_type}, Amount: ${t.amount}, Status: ${t.status}, Error: ${t.error_message || 'None'}`);
  });
}

runTest().catch(console.error);
