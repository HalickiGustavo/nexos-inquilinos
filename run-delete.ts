import { deleteAzureContracts } from './src/lib/delete-azure.functions';

async function run() {
  console.log('Running Azure contract cleanup...');
  try {
    const result = await deleteAzureContracts();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (e) {
    console.error('Execution error:', e);
    process.exit(1);
  }
}

run();
