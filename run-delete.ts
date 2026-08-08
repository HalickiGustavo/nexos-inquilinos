import { deleteAzureContracts } from './src/lib/delete-azure.functions';

async function run() {
  console.log('Running Azure contract cleanup...');
  const result = await deleteAzureContracts();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
