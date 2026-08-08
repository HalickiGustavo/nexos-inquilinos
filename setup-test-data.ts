import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function setup() {
  console.log("--- LIMPANDO DADOS ANTIGOS ---");
  await supabase.from('installments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('contracts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tenants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // 1. IDs
  const managerId = 'd101d276-6dee-479a-996c-fcf60695e4de'; // Azure
  const landlordId = '25aa2476-35ec-46db-a7d3-263d48fbe90b'; // Eduardo
  
  // 2. Criar Inquilino (Halicki Gustavo)
  console.log("Criando Inquilino...");
  const { data: tenant, error: tErr } = await supabase.from('tenants').insert({
    full_name: 'Halicki Gustavo',
    email: 'halickigustavo@gmail.com',
    document: '69584712061', // CPF Valido fake ou gerado
    phone: '11999999999',
    manager_user_id: managerId
  }).select().single();
  if (tErr) throw tErr;

  // 3. Criar Imovel
  console.log("Criando Imovel...");
  const { data: property, error: pErr } = await supabase.from('properties').insert({
    title: 'Imovel Teste Pagamento',
    address: 'Rua Teste, 123',
    landlord_id: landlordId,
    manager_user_id: managerId,
    price: 50.25,
    default_management_fee_percent: 10
  }).select().single();
  if (pErr) throw pErr;

  // 4. Criar Contrato
  console.log("Criando Contrato...");
  const { data: contract, error: cErr } = await supabase.from('contracts').insert({
    property_id: property.id,
    tenant_id: tenant.id,
    user_id: managerId,
    start_date: new Date().toISOString(),
    rent_amount: 50.25,
    status: 'active'
  }).select().single();
  if (cErr) throw cErr;

  // 5. Criar Parcelas
  console.log("Criando Parcelas...");
  const { data: installment, error: iErr } = await supabase.from('installments').insert([
    {
      contract_id: contract.id,
      description: 'Primeira Parcela',
      amount: 50.25,
      due_date: '2026-08-05',
      status: 'pendente'
    },
    {
      contract_id: contract.id,
      description: 'Segunda Parcela',
      amount: 50.25,
      due_date: '2026-09-05',
      status: 'pendente'
    }
  ]).select().single();
  if (iErr) throw iErr;

  console.log("Setup concluido com sucesso!");
  console.log("Parcela ID:", installment.id);
}

setup().catch(console.error);
