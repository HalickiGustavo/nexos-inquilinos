import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ChatArea } from "@/components/chat/ChatArea";

export const Route = createFileRoute("/_authenticated/tenant/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Nexo" },
      { name: "description", content: "Converse em tempo real com a imobiliária e o proprietário do seu imóvel." },
      { property: "og:title", content: "Chat — Nexo" },
      { property: "og:description", content: "Converse em tempo real com a imobiliária e o proprietário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TenantChatPage,
});

function TenantChatPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" />
          Chat
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fale diretamente com a imobiliária e o proprietário.
        </p>
      </header>
      <ChatArea />
    </div>
  );
}
