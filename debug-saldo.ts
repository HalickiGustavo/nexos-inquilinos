import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function debugSaldo() {
  console.log("--- DEBUG SALDO EFI ---");
  const url = process.env.EFI_PROXY_URL;
  const secret = process.env.EFI_PROXY_SECRET;
  console.log("EFI_PROXY_URL:", url ? "Set" : "Not Set");
  console.log("EFI_PROXY_SECRET:", secret ? "Set" : "Not Set");

  if (!url || !secret) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-efi-proxy-secret": secret },
      body: JSON.stringify({ action: "saldo_get", params: {} }),
    });
    const body = await res.json();
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(body, null, 2));
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

debugSaldo();
