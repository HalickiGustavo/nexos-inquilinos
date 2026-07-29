import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { ChatArea } from "@/components/chat/ChatArea";

export const Route = createFileRoute("/_landlord/landlord/chat")({
  head: () => ({
    meta: [
      { title: "Chat do proprietário — Nexo" },
      { name: "description", content: "Converse em tempo real com a imobiliária e os inquilinos dos seus imóveis." },
      { property: "og:title", content: "Chat do proprietário — Nexo" },
      { property: "og:description", content: "Converse em tempo real com a imobiliária e os inquilinos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandlordChatPage,
});

function LandlordChatPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Comunicação"
        title="Chat"
        icon={MessageSquare}
        description="Fale com a imobiliária e com os inquilinos dos seus imóveis em tempo real."
      />
      <ChatArea />
    </PageShell>
  );
}
