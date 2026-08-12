
import { fetch } from "undici";

async function listInstances() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error("Configuração ausente.");
    return;
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/instance/fetchInstances`;
  
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "apikey": apiKey },
    });

    const data = await res.json();
    console.log("Instâncias encontradas:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao listar instâncias:", error);
  }
}

listInstances();
