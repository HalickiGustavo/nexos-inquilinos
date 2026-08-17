import { createClient } from '@supabase/supabase-js';

/**
 * NEXO MIGRATION SCRIPT (ETL)
 * 
 * Este script copia dados do projeto origem para o destino.
 * IMPORTANTE: 
 * 1. O esquema (tabelas) deve ser criado primeiro usando full_schema.sql.
 * 2. Desabilite triggers temporariamente no destino se houver dependências circulares.
 */

const SOURCE_URL = 'https://zmqkuifaatqqisovrfbz.supabase.co';
const SOURCE_KEY = 'SUA_SERVICE_ROLE_KEY_ORIGEM'; // Não disponível na Lovable Cloud para exportação direta

const TARGET_URL = 'https://SEU_NOVO_PROJETO.supabase.co';
const TARGET_KEY = 'SUA_SERVICE_ROLE_KEY_DESTINO';

const source = createClient(SOURCE_URL, SOURCE_KEY);
const target = createClient(TARGET_URL, TARGET_KEY);

// Ordem de inserção para respeitar chaves estrangeiras
const TABLES = [
  'profiles',
  'tenants',
  'properties',
  'contracts',
  'installments',
  'maintenances',
  'user_roles',
  'manager_members',
  'documents',
  'platform_settings',
  'crm_leads',
  'inspections'
];

async function migrateTable(tableName: string) {
  console.log(`\n--- Migrando tabela: ${tableName} ---`);
  
  const { data, error: fetchError } = await source
    .from(tableName)
    .select('*');

  if (fetchError) {
    console.error(`Erro ao buscar dados de ${tableName}:`, fetchError);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`Tabela ${tableName} está vazia.`);
    return;
  }

  console.log(`Lendo ${data.length} registros da origem...`);

  // Inserção em lotes para evitar timeout
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error: insertError } = await target
      .from(tableName)
      .upsert(batch, { onConflict: 'id' });

    if (insertError) {
      console.error(`Erro ao inserir lote em ${tableName}:`, insertError);
    } else {
      console.log(`Lote ${i / batchSize + 1} de ${tableName} inserido.`);
    }
  }
}

async function run() {
  console.log('Iniciando migração Nexo...');
  
  for (const table of TABLES) {
    await migrateTable(table);
  }

  console.log('\nMigração concluída com sucesso!');
}

run().catch(console.error);
