import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function setup() {
  console.log("--- SETUP TEST DATA (DEBUG) ---");
  
  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; 
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; 
  
  const t = await supabase.from('tenants').insert({
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061',
    phone: '11999999999'
  }).select().single();
  console.log("Tenant:", JSON.stringify(t, null, 2));

  const p = await supabase.from('properties').insert({
    title: 'Imovel Teste Pagamento',
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    manager_user_id: managerId,
    price: 50.25,
    default_management_fee_percent: 10
  }).select().single();
  console.log("Property:", JSON.stringify(p, null, 2));

  if (p.data) {
    const c = await supabase.from('contracts').insert({
      property_id: p.data.id,
      tenant_id: t.data.id,
      user_id: managerId,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      due_day: 5,
      rent_amount: 50.25,
      active: true
    }).select().single();
    console.log("Contract:", JSON.stringify(c, null, 2));

    if (c.data) {
      const i = await supabase.from('installments').insert({
        contract_id: c.data.id,
        description: 'Primeira Parcela',
        amount: 50.25,
        due_date: '2026-08-05',
        status: 'pendente'
      }).select().single();
      console.log("Installment:", JSON.stringify(i, null, 2));
    }
  }
}

setup().catch(console.error);
