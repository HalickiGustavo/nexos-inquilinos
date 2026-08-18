import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/integrations/supabase/types';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('Starting seed process...');

  try {
    // 1. Create Test Users in Auth (using service role)
    // We'll use fixed UUIDs for consistency in testing if possible, 
    // but auth.admin.createUser generates its own.
    
    const testUsers = [
      { email: 'manager@test.com', password: 'Teste@2026', role: 'manager', full_name: 'Imobiliária Nexo' },
      { email: 'owner@test.com', password: 'Teste@2026', role: 'owner', full_name: 'Eduardo Proprietário' },
      { email: 'tenant@test.com', password: 'Teste@2026', role: 'tenant', full_name: 'Gustavo Inquilino' },
      { email: 'admin@test.com', password: 'Teste@2026', role: 'platform_admin', full_name: 'Admin Nexo' },
    ];

    const userMap: Record<string, string> = {};

    for (const u of testUsers) {
      console.log(`Creating user: ${u.email}`);
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`User ${u.email} already exists, fetching ID...`);
          const { data: existingUser } = await supabase.rpc('get_user_id_by_email', { email_val: u.email } as any);
          // If RPC doesn't exist, we'll try to list users
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = listData.users.find(usr => usr.email === u.email);
          if (found) userMap[u.role] = found.id;
        } else {
          console.error(`Error creating user ${u.email}:`, error.message);
        }
      } else if (data.user) {
        userMap[u.role] = data.user.id;
      }

      // Ensure user has the correct role
      if (userMap[u.role]) {
        await supabase.from('user_roles').upsert({
          user_id: userMap[u.role],
          role: u.role as any
        }, { onConflict: 'user_id,role' });
      }
    }

    const managerId = userMap['manager'];
    const ownerId = userMap['owner'];
    const tenantUserId = userMap['tenant'];

    if (!managerId || !ownerId || !tenantUserId) {
      console.error('Failed to get all user IDs. userMap:', userMap);
      return;
    }

    // 2. Create Properties
    console.log('Creating properties...');
    const { data: properties, error: propError } = await supabase.from('properties').upsert([
      {
        user_id: managerId,
        manager_id: managerId,
        landlord_id: ownerId,
        nickname: 'Apartamento Centro',
        address: 'Rua das Flores, 123',
        city: 'Curitiba',
        state: 'PR',
        type: 'apartamento',
        rent_price: 1500.00,
        condo_fee: 300.00,
        iptu: 50.00,
        status: 'disponivel'
      },
      {
        user_id: managerId,
        manager_id: managerId,
        landlord_id: ownerId,
        nickname: 'Casa Jardim',
        address: 'Av. Brasil, 456',
        city: 'Curitiba',
        state: 'PR',
        type: 'casa',
        rent_price: 2500.00,
        condo_fee: 0,
        iptu: 120.00,
        status: 'alugado'
      }
    ]).select();

    if (propError) throw propError;

    // 3. Create Tenant Record
    console.log('Creating tenant record...');
    const { data: tenantRecord, error: tenantError } = await supabase.from('tenants').upsert({
      user_id: managerId,
      user_id_link: tenantUserId,
      full_name: 'Gustavo Inquilino',
      email: 'tenant@test.com',
      document: '12345678901'
    }).select().single();

    if (tenantError) throw tenantError;

    // 4. Create Contract
    console.log('Creating contract...');
    const propertyToRent = properties.find(p => p.nickname === 'Casa Jardim')!;
    const { data: contract, error: contractError } = await supabase.from('contracts').upsert({
      user_id: managerId,
      property_id: propertyToRent.id,
      tenant_id: tenantRecord.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      due_day: 10,
      rent_amount: 2500.00,
      active: true
    }).select().single();

    if (contractError) throw contractError;

    // 5. Create Installments
    console.log('Creating installments...');
    const today = new Date();
    const installments = [];
    for (let i = 0; i < 3; i++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() + i, 10);
      installments.push({
        user_id: managerId,
        contract_id: contract.id,
        due_date: dueDate.toISOString().split('T')[0],
        amount: 2500.00,
        status: i === 0 ? 'pago' : 'pendente',
        paid_amount: i === 0 ? 2500.00 : 0,
        payment_date: i === 0 ? new Date().toISOString() : null
      });
    }

    const { error: instError } = await supabase.from('installments').upsert(installments);
    if (instError) throw instError;

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Error during seed:', err);
  }
}

seed();
