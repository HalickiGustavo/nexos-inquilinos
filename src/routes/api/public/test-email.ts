
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resetUserPassword } from "@/lib/auth-admin.functions";

export const Route = createFileRoute("/api/public/test-email")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await resetUserPassword({ data: { email: "azure.cosmeticos2025@gmail.com", password: "Azure@2025" } });
          return new Response("Senha alterada com sucesso para Azure@2025", { status: 200 });
        } catch (err: any) {
          return new Response("Erro: " + err.message, { status: 500 });
        }
      }
    }
  }
});
