import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatRequestBody = { messages?: unknown };

const PRIORITY_LABEL: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluída",
};

function textOf(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Não autenticado", { status: 401 });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend não configurado", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("Assistente indisponível no momento", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return new Response("Não autenticado", { status: 401 });

        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("Mensagens obrigatórias", { status: 400 });
        }
        const uiMessages = messages as UIMessage[];

        // --- Contexto do inquilino ---
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, full_name, user_id")
          .eq("user_id_link", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        const { data: contract } = tenant
          ? await supabase
              .from("contracts")
              .select(
                "id, start_date, end_date, due_day, rent_amount, active, property_id, user_id, property:properties(id, nickname, address, city, state)",
              )
              .eq("tenant_id", tenant.id)
              .eq("active", true)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null };

        // Persiste a última mensagem do usuário
        const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const { error: insertUserError } = await supabase
            .from("support_chat_messages")
            .insert({
              user_id: user.id,
              role: "user",
              client_message_id: lastUser.id,
              parts: lastUser.parts as unknown as Database["public"]["Tables"]["support_chat_messages"]["Insert"]["parts"],
            });
          if (insertUserError) {
            console.error("[support-chat] falha ao salvar mensagem do usuário", insertUserError);
          }
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);

        const tools = {
          consultar_contrato: tool({
            description:
              "Retorna dados do imóvel e do contrato do inquilino: endereço, data de início, término, dia de vencimento e valor do aluguel.",
            inputSchema: z.object({}),
            execute: async () => {
              if (!contract) return { encontrado: false };
              const property = (contract as any).property;
              return {
                encontrado: true,
                imovel: property?.nickname ?? "—",
                endereco: [property?.address, property?.city, property?.state]
                  .filter(Boolean)
                  .join(", "),
                inicio: contract.start_date,
                termino: contract.end_date,
                dia_vencimento: contract.due_day,
                valor_aluguel: Number(contract.rent_amount),
                ativo: contract.active,
              };
            },
          }),

          listar_manutencoes: tool({
            description:
              "Lista o histórico de manutenções do imóvel do inquilino, com descrição, prioridade, status e datas. Use quando o inquilino perguntar sobre chamados anteriores ou o andamento de um chamado.",
            inputSchema: z.object({
              status: z
                .enum(["pendente", "em_andamento", "concluido", "todos"])
                .describe("Filtro de status; use 'todos' para o histórico completo."),
            }),
            execute: async ({ status }) => {
              if (!tenant) return { chamados: [] };
              let query = supabase
                .from("maintenances")
                .select("id, title, description, priority, status, created_at, scheduled_date, completed_date")
                .eq("tenant_id", tenant.id)
                .order("created_at", { ascending: false })
                .limit(20);
              if (status !== "todos") query = query.eq("status", status as any);
              const { data, error } = await query;
              if (error) return { erro: error.message, chamados: [] };
              return {
                chamados: (data ?? []).map((m: any) => ({
                  id: m.id,
                  titulo: m.title,
                  descricao: m.description,
                  prioridade: PRIORITY_LABEL[m.priority] ?? m.priority,
                  status: STATUS_LABEL[m.status] ?? m.status,
                  solicitado_em: m.created_at,
                  agendado_para: m.scheduled_date,
                  concluido_em: m.completed_date,
                })),
              };
            },
          }),

          criar_manutencao: tool({
            description:
              "Abre um novo chamado de manutenção para o imóvel do inquilino. Só chame depois de ter título, descrição detalhada e prioridade confirmados pelo inquilino.",
            inputSchema: z.object({
              titulo: z.string().describe("Resumo curto do problema."),
              descricao: z.string().describe("Descrição detalhada da manutenção solicitada."),
              prioridade: z.enum(["alta", "media", "baixa"]),
            }),
            execute: async ({ titulo, descricao, prioridade }) => {
              if (!tenant || !contract) {
                return { ok: false, erro: "Não encontramos um contrato ativo vinculado à sua conta." };
              }
              const { data, error } = await supabase
                .from("maintenances")
                .insert({
                  user_id: contract.user_id,
                  tenant_id: tenant.id,
                  property_id: contract.property_id,
                  contract_id: contract.id,
                  title: titulo.slice(0, 120),
                  description: descricao.slice(0, 2000),
                  priority: prioridade,
                  status: "pendente",
                  responsible: "proprietario",
                } as any)
                .select("id, title, priority, status, created_at")
                .single();
              if (error) {
                console.error("[support-chat] falha ao criar manutenção", error);
                return { ok: false, erro: error.message };
              }
              return {
                ok: true,
                id: data.id,
                titulo: data.title,
                prioridade: PRIORITY_LABEL[prioridade],
                status: "Pendente",
                solicitado_em: data.created_at,
                aviso: "A imobiliária e o proprietário foram notificados no painel deles.",
              };
            },
          }),
        };

        const propertyName = (contract as any)?.property?.nickname;

        const system = [
          "Você é a Nexo, assistente de suporte ao inquilino de uma plataforma de gestão de aluguéis, no Brasil.",
          "Responda sempre em português do Brasil, com tom cordial, objetivo e humano. Use markdown curto (listas, negrito) quando ajudar.",
          "Suas capacidades: abrir chamados de manutenção, consultar o histórico de manutenções e informar dados do imóvel e do contrato.",
          "Ao abrir um chamado: colete descrição do problema, confirme a prioridade (alta, média ou baixa) e só então use a ferramenta criar_manutencao. A data de solicitação é sempre a data de hoje e o status inicial é sempre 'pendente'.",
          "Prioridades válidas: alta, media, baixa. Status válidos: pendente, em andamento, concluída.",
          "Nunca invente valores, datas ou chamados: use as ferramentas para buscar dados reais.",
          "Assuntos fora de manutenção/contrato/imóvel: oriente o inquilino a usar as abas Financeiro, Documentos ou o botão de suporte no WhatsApp.",
          tenant ? `Inquilino: ${tenant.full_name}.` : "Este usuário ainda não tem cadastro de inquilino ativo.",
          propertyName ? `Imóvel atual: ${propertyName}.` : "",
          `Data de hoje: ${new Date().toISOString().slice(0, 10)}.`,
        ]
          .filter(Boolean)
          .join("\n");

        const result = streamText({
          model: gateway("openai/gpt-5.6-sol"),
          system,
          messages: await convertToModelMessages(uiMessages),
          tools,
          stopWhen: stepCountIs(50),
          providerOptions: { lovable: { reasoningEffort: "none" } },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            if (!responseMessage) return;
            const { error } = await supabase.from("support_chat_messages").insert({
              user_id: user.id,
              role: "assistant",
              client_message_id: responseMessage.id,
              parts: responseMessage.parts as unknown as Database["public"]["Tables"]["support_chat_messages"]["Insert"]["parts"],
            });
            if (error) {
              console.error("[support-chat] falha ao salvar resposta", error);
            }
          },
        });
      },
    },
  },
});

export { textOf };
