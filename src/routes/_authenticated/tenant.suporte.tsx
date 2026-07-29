import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wrench, History, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import assistantLogo from "@/assets/nexo-assistant.png";

export const Route = createFileRoute("/_authenticated/tenant/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte NEXO — Assistente do inquilino" },
      {
        name: "description",
        content:
          "Converse com a assistente NEXO para abrir chamados de manutenção, acompanhar o histórico e consultar dados do seu contrato.",
      },
      { property: "og:title", content: "Suporte NEXO — Assistente do inquilino" },
      {
        property: "og:description",
        content: "Abra chamados de manutenção e consulte seu contrato pelo chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TenantSupportChat,
});

const SUGGESTIONS = [
  { icon: Wrench, label: "Abrir um chamado de manutenção", text: "Preciso abrir um chamado de manutenção." },
  { icon: History, label: "Ver histórico de manutenções", text: "Quero ver o histórico de manutenções do meu imóvel." },
  { icon: FileText, label: "Dados do meu contrato", text: "Quais são os dados do meu contrato e do imóvel?" },
];

function TenantSupportChat() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setToken(data.session?.access_token ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { data: history, isPending: loadingHistory } = useQuery({
    queryKey: ["support-chat", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_chat_messages")
        .select("id, role, parts, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        role: row.role as UIMessage["role"],
        parts: (row.parts ?? []) as UIMessage["parts"],
      })) satisfies UIMessage[];
    },
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    [token],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "tenant-support",
    transport,
    onError: (e) => toast.error(e.message || "Não foi possível falar com a assistente agora."),
  });

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !history) return;
    hydrated.current = true;
    if (history.length > 0) setMessages(history);
  }, [history, setMessages]);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, loadingHistory]);

  async function submit(text: string) {
    const value = text.trim();
    if (!value || busy || !token) return;
    setInput("");
    await sendMessage({ text: value });
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3">
        <img
          src={assistantLogo}
          alt="Assistente NEXO"
          width={512}
          height={512}
          loading="lazy"
          className="size-11 rounded-xl bg-card border p-1 object-contain shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Suporte NEXO</h1>
          <p className="text-sm text-muted-foreground">
            Abra chamados de manutenção, acompanhe o histórico e tire dúvidas do contrato.
          </p>
        </div>
      </header>

      <Card className="flex flex-col overflow-hidden h-[calc(100dvh-16rem)] min-h-[420px]">
        <Conversation className="flex-1">
          <ConversationContent className="gap-4">
            {loadingHistory ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="h-12 w-1/2 ml-auto" />
                <Skeleton className="h-20 w-4/5" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center space-y-4">
                <img
                  src={assistantLogo}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  className="size-16 mx-auto object-contain"
                />
                <div>
                  <p className="font-semibold">Olá! Sou a assistente NEXO.</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    Posso abrir um chamado de manutenção, mostrar o histórico do seu imóvel e
                    consultar seu contrato.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center flex-wrap">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s.label}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => submit(s.text)}
                      disabled={!token}
                    >
                      <s.icon className="size-4" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        return <MessageResponse key={i}>{part.text}</MessageResponse>;
                      }
                      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                        const p = part as any;
                        return (
                          <Tool key={i} defaultOpen={false}>
                            <ToolHeader type={p.type} state={p.state} />
                            <ToolContent>
                              <ToolInput input={p.input} />
                              <ToolOutput output={p.output} errorText={p.errorText} />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && <Shimmer>Pensando...</Shimmer>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-3">
          <PromptInput
            onSubmit={(message, event) => {
              event.preventDefault();
              void submit(message.text || input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva o que você precisa..."
              disabled={!token}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() || !token} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Card>
    </PageShell>
  );
}
