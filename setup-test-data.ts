import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function setup() {
  console.log("--- SETUP TEST DATA (FINAL) ---");
  
  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; 
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; 
  const tenantUserId = '9db43155-2dfd-4416-9fae-1dec2589b8d7';

  // 1. Inquilino (user_id é obrigatório e único)
  const { data: tenant, error: tErr } = await supabase.from('tenants').upsert({
    user_id: tenantUserId,
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061',
    phone: '11999999999'
  }).select().single();
  if (tErr) {
     console.error("Tenant Error:", tErr);
     return;
  }

  // 2. Imóvel (manager_user_id não existe, usa user_id do manager ou landlord_id)
  const { data: property, error: pErr } = await supabase.from('properties').insert({
    title: 'Imovel Teste Pagamento',
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    price: 50.25,
    default_management_fee_percent: 10
  }).select().single();
  if (pErr) {
    console.error("Property Error:", pErr);
    return;
  }

  // 3. Contrato
  const { data: contract, error: cErr } = await supabase.from('contracts').insert({
    property_id: property.id,
    tenant_id: tenant.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    due_day: 5,
    rent_amount: 50.25,
    active: true
  }).select().single();
  if (cErr) {
    console.error("Contract Error:", cErr);
    return;
  }

  // 4. Parcela
  const { data: installment, error: iErr } = await supabase.from('installments').insert({
    contract_id: contract.id,
    description: 'Primeira Parcela',
    amount: 50.25,
    due_date: '2026-08-05',
    status: 'pendente'
  }).select().single();
  
  if (iErr) {
    console.error("Installment Error:", iErr);
    return;
  }

  console.log("Setup concluído com sucesso!");
  console.log("Parcela ID:", installment.id);
}

setup().catch(console.error);
