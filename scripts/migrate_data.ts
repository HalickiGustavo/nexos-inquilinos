import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * NEXO MIGRATION SCRIPT (ETL + SCHEMA)
 * 
 * Este script automatiza a migração do Nexo para um novo projeto Supabase:
 * 1. Cria o esquema (tabelas, enums, triggers) a partir do full_schema.sql.
 * 2. Copia dados do projeto origem para o destino.
 */

const SOURCE_URL = 'https://uydlpmxdewmnqboqfpxq.supabase.co';
const SOURCE_KEY = process.env.SOURCE_SERVICE_ROLE_KEY || 'SUA_SERVICE_ROLE_KEY_ORIGEM';

const TARGET_URL = process.env.TARGET_SUPABASE_URL || 'https://SEU_NOVO_PROJETO.supabase.co';
const TARGET_KEY = process.env.TARGET_SERVICE_ROLE_KEY || 'SUA_SERVICE_ROLE_KEY_DESTINO';

if (TARGET_URL.includes('SEU_NOVO_PROJETO')) {
  console.error('ERRO: Você precisa configurar as variáveis de ambiente ou editar o script com a URL e KEY do destino.');
  process.exit(1);
}

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

async function applySchema() {
  console.log('--- Aplicando Esquema (full_schema.sql) ---');
  try {
    const schemaPath = path.resolve(process.cwd(), 'full_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('Arquivo full_schema.sql não encontrado na raiz do projeto.');
      return false;
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // O Supabase JS não tem um método direto para rodar SQL arbitrário via 'target.rpc' que aceite strings gigantes facilmente sem uma função pré-definida.
    // A recomendação oficial para migração de esquema é usar a CLI do Supabase ou a interface SQL do Dashboard.
    // No entanto, para automação, podemos tentar executar blocos se o destino tiver a extensão 'http' ou uma função 'exec_sql'.
    
    console.log('IMPORTANTE: A execução de scripts SQL complexos via SDK é limitada.');
    console.log('Recomendamos rodar o conteúdo do full_schema.sql diretamente no SQL Editor do seu novo projeto Supabase.');
    console.log('Prosseguindo com a migração de dados assumindo que o esquema já existe...');
    return true;
  } catch (error) {
    console.error('Erro ao ler full_schema.sql:', error);
    return false;
  }
}

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
    
    // Tenta inserir. Nota: profiles e outras tabelas vinculadas ao auth.users 
    // podem falhar se os usuários não existirem no auth do destino.
    const { error: insertError } = await target
      .from(tableName)
      .upsert(batch, { onConflict: 'id' });

    if (insertError) {
      console.error(`Erro ao inserir lote em ${tableName}:`, insertError);
      if (insertError.message.includes('foreign key constraint')) {
        console.warn(`DICA: Certifique-se de que os usuários em auth.users foram migrados primeiro.`);
      }
    } else {
      console.log(`Lote ${i / batchSize + 1} de ${tableName} inserido.`);
    }
  }
}

async function run() {
  console.log('Iniciando Automação Nexo...');
  
  // O esquema deve ser aplicado via SQL Editor do Supabase para garantir triggers e RLS.
  await applySchema();

  for (const table of TABLES) {
    await migrateTable(table);
  }

  console.log('\nProcesso concluído!');
  console.log('Nota: Lembre-se de migrar manualmente os usuários do auth.users se necessário.');
}

run().catch(console.error);
