import { supabaseAdmin } from "./integrations/supabase/client.server";

async function diagnose() {
  console.log("--- DIAGNOSTICO DE USUARIOS ---");
  const users = await supabaseAdmin.from('profiles').select('id, email, full_name, pix_key');
  console.log("Usuarios:", JSON.stringify(users.data, null, 2));

  console.log("\n--- DIAGNOSTICO DE CONTRATOS ---");
  const contracts = await supabaseAdmin.from('contracts').select('id, user_id, status, property:properties(id, landlord_id)');
  console.log("Contratos:", JSON.stringify(contracts.data, null, 2));

  console.log("\n--- DIAGNOSTICO DE PARCELAS ---");
  const installments = await supabaseAdmin.from('installments').select('id, status, amount, due_date, contract_id').limit(10);
  console.log("Parcelas:", JSON.stringify(installments.data, null, 2));

  console.log("\n--- DIAGNOSTICO DE TRANSFERENCIAS PENDENTES ---");
  const transfers = await supabaseAdmin.from('payment_transfers').select('*').eq('status', 'PENDING');
  console.log("Transferencias PENDENTES:", JSON.stringify(transfers.data, null, 2));

  console.log("\n--- EFI CONFIG CHECK ---");
  console.log("EFI_PROXY_URL:", process.env.EFI_PROXY_URL ? "OK" : "MISSING");
  console.log("EFI_PIX_KEY:", process.env.EFI_PIX_KEY ? "OK" : "MISSING");
}

diagnose();
