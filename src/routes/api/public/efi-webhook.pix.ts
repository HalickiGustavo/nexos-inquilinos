// Efí anexa "/pix" ao final da URL registrada como parte do path do webhook
// de recebimentos PIX. Esta rota espelha `/api/public/efi-webhook` para que a
// chamada `.../efi-webhook/pix?hmac=<SECRET>` seja atendida corretamente.
// A validação HMAC + processamento estão implementados no handler compartilhado.
import { createFileRoute } from "@tanstack/react-router";
import { handle } from "./efi-webhook";

export const Route = createFileRoute("/api/public/efi-webhook/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
