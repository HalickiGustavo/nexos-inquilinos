import { createServerFn } from "@tanstack/react-start";

export const getCrmApiKey = createServerFn({ method: "GET" })
  .handler(async () => {
    // This only runs on the server
    const key = process.env['EXTERNAL_CRM_API_KEY'];
    if (!key) {
      throw new Error("Chave não configurada");
    }
    return { key };
  });
