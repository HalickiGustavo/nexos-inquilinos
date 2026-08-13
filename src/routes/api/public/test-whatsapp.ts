import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        if (!baseUrl || !apiKey) {
          return new Response(JSON.stringify({ error: "Config missing", baseUrl: !!baseUrl, apiKey: !!apiKey }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        try {
          // According to Evolution API docs, fetching instances is GET /instance/fetchInstances
          const url = `${baseUrl.replace(/\/+$/, "")}/instance/fetchInstances`;
          console.log(`[Test] Fetching instances from: ${url}`);
          
          const res = await fetch(url, {
            method: "GET",
            headers: { "apikey": apiKey }
          });
          
          const data = await res.json();
          return new Response(JSON.stringify({
            status: res.status,
            data
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
