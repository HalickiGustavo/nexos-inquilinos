import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendResendEmail } from "./resend.server";

export const sendTenantConfirmationTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Role gate: apenas managers/owners podem disparar e-mails de teste
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    
    if (!isManager && !isOwner) {
      throw new Error("Forbidden");
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333;">Boas-vindas à NEXO!</h2>
        <p>Olá! Este é um e-mail de teste do template de <strong>confirmação de inquilino</strong>.</p>
        <p>Para concluir seu cadastro e acessar o painel do inquilino, clique no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://dashboard.usenexoapp.com/tenant-setup" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirmar E-mail</a>
        </div>
        <p style="color: #666; font-size: 14px;">Se você não solicitou este cadastro, pode ignorar este e-mail.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">NEXO &copy; 2026</p>
      </div>
    `;

    return await sendResendEmail({
      to: data.email,
      subject: "Boas-vindas à NEXO - Confirmação de Cadastro",
      html,
    });
  });
