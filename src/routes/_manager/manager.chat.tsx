import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { ChatArea } from "@/components/chat/ChatArea";

export const Route = createFileRoute("/_manager/manager/chat")({
  head: () => ({
    meta: [
      { title: "Chat da imobiliária — Nexo" },
      { name: "description", content: "Converse em tempo real com inquilinos e proprietários da sua carteira." },
      { property: "og:title", content: "Chat da imobiliária — Nexo" },
      { property: "og:description", content: "Converse em tempo real com inquilinos e proprietários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerChatPage,
});

function ManagerChatPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Comunicação"
        title="Chat"
        icon={MessageSquare}
        description="Converse com inquilinos e proprietários e abra chamados de manutenção sem sair da conversa."
      />
      <ChatArea />
    </PageShell>
  );
}
