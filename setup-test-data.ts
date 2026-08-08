import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function setup() {
  console.log("--- SETUP TEST DATA ---");
  
  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; // Azure
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; // Eduardo
  
  // Criar Inquilino
  const { data: tenant } = await supabase.from('tenants').insert({
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061',
    phone: '11999999999'
  }).select().single();

  // Criar Imovel
  const { data: property } = await supabase.from('properties').insert({
    title: 'Imovel Teste Pagamento',
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    manager_user_id: managerId,
    price: 50.25,
    default_management_fee_percent: 10
  }).select().single();

  // Criar Contrato
  const { data: contract } = await supabase.from('contracts').insert({
    property_id: property.id,
    tenant_id: tenant.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    rent_amount: 50.25,
    status: 'active'
  }).select().single();

  // Criar Parcela
  const { data: installment } = await supabase.from('installments').insert({
    contract_id: contract.id,
    description: 'Primeira Parcela',
    amount: 50.25,
    due_date: '2026-08-05',
    status: 'pendente'
  }).select().single();

  console.log("Setup concluido!");
  console.log("Parcela ID:", installment.id);
}

setup().catch(console.error);
