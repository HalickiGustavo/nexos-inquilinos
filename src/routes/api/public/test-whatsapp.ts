import { createFileRoute } from '@tanstack/react-router';
import { sendEvolutionText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        if (!baseUrl || !apiKey) {
          return new Response("Config missing", { status: 500 });
        }

        try {
          const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/instance/fetchInstances`, {
            headers: { "apikey": apiKey }
          });
          const instances = await res.json();
          return new Response(JSON.stringify(instances), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(String(e), { status: 500 });
        }
      }
    }
  }
});
