import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskCpfCnpj } from "./br-validators";

/**
 * Sends a welcome email to a new Owner (Proprietário) or Agency (Imobiliária)
 * after they complete the registration wizard.
 */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(1),
        role: z.enum(["imobiliaria", "proprietario"]),
        document: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { sendResendEmail } = await import("./resend.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // We use supabaseAdmin to verify the user role safely
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const actualRole = roleData?.role;
    const isOwner = actualRole === "owner";
    const isManager = actualRole === "manager";

    if (!isOwner && !isManager) {
      console.warn("[email] User does not have owner/manager role yet", { userId, actualRole });
    }

    const title = data.role === "imobiliaria" ? "Imobiliária" : "Proprietário";
    const maskedDoc = data.document ? maskCpfCnpj(data.document) : "Não informado";

    const html = `
      <div style="font-family: sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin-bottom: 10px;">Boas-vindas à NEXO!</h1>
          <p style="font-size: 16px; color: #71717a;">Sua conta de <strong>${title}</strong> foi criada com sucesso.</p>
        </div>
        
        <div style="background-color: #f4f4f5; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
          <h2 style="font-size: 18px; margin-top: 0; margin-bottom: 16px; color: #18181b;">Resumo do seu cadastro</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #71717a; width: 120px;">Nome:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a;">Documento:</td>
              <td style="padding: 8px 0; font-weight: 500;">${maskedDoc}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #71717a;">E-mail:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.email}</td>
            </tr>
          </table>
        </div>

        <p>A partir de agora, você tem acesso completo à plataforma NEXO para gerir seus contratos, imóveis e repasses de forma automatizada.</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="https://dashboard.usenexoapp.com/login" 
             style="background-color: #7c3aed; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
             Acessar meu Painel
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 40px 0;" />
        
        <p style="font-size: 14px; color: #71717a; text-align: center;">
          Se você tiver qualquer dúvida, responda a este e-mail ou entre em contato pelo nosso WhatsApp de suporte.
        </p>
        
        <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 20px;">
          NEXO — Soluções Inteligentes para o Mercado Imobiliário
        </p>
      </div>
    `;

    try {
      await sendResendEmail({
        to: data.email,
        subject: `Boas-vindas à NEXO — Sua conta de ${title} está pronta!`,
        html,
      });

      // Log the event for audit
      await supabaseAdmin.from("email_send_log").insert({
        template_name: "welcome_owner_manager",
        recipient_email: data.email,
        status: "sent",
        metadata: { userId, role: data.role },
      });

      return { ok: true };
    } catch (error: any) {
      console.error("[email] Failed to send welcome email:", error.message);
      return { ok: false, error: error.message };
    }
  });
