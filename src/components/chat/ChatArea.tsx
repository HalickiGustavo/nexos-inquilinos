import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  getAttachmentUrl,
  useChatRealtime,
  useConversations,
  useMarkRead,
  useMessages,
  useSendMessage,
  type ChatAttachment,
  type ChatConversation,
} from "@/lib/chat";
import { MaintenanceRequestDialog } from "@/components/chat/MaintenanceRequestDialog";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatStamp(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
        " " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AttachmentChip({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = (attachment.mime ?? "").startsWith("image/");

  useEffect(() => {
    let alive = true;
    getAttachmentUrl(attachment.path)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [attachment.path]);

  if (isImage) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          className="rounded-lg max-h-56 w-auto object-cover border border-border/50"
        />
      </a>
    ) : (
      <Skeleton className="h-32 w-44 rounded-lg" />
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
    >
      <FileText className="size-4 shrink-0 text-primary" />
      <span className="truncate max-w-[180px]">{attachment.name}</span>
    </a>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (c: ChatConversation) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <MessageSquare className="size-8 mx-auto mb-3 opacity-40" />
        Nenhuma conversa ativa ainda. As conversas aparecem automaticamente quando existe um
        contrato de locação vinculado.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
              activeId === c.id && "bg-muted",
            )}
          >
            <Avatar className="size-11 shrink-0">
              {c.counterpartAvatar && <AvatarImage src={c.counterpartAvatar} alt={c.counterpartName} />}
              <AvatarFallback>{initials(c.counterpartName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.counterpartName}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatStamp(c.last_message_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">
                  {c.last_message_preview ?? `${c.counterpartRole} · ${c.title ?? "Imóvel"}`}
                </span>
                {c.unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                    {c.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Thread({
  conversation,
  onBack,
}: {
  conversation: ChatConversation;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useMessages(conversation.id);
  const send = useSendMessage(conversation.id);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useChatRealtime(conversation.id);
  useMarkRead(conversation.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const submit = async () => {
    if (!text.trim() && files.length === 0) return;
    try {
      await send.mutateAsync({ content: text, files });
      setText("");
      setFiles([]);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível enviar a mensagem");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="size-4" />
        </Button>
        <Avatar className="size-9">
          {conversation.counterpartAvatar && (
            <AvatarImage src={conversation.counterpartAvatar} alt={conversation.counterpartName} />
          )}
          <AvatarFallback>{initials(conversation.counterpartName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{conversation.counterpartName}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {conversation.counterpartRole}
            {conversation.title ? ` · ${conversation.title}` : ""}
          </div>
        </div>
        <MaintenanceRequestDialog
          contractId={conversation.contract_id}
          propertyId={conversation.property_id}
        />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3 bg-muted/20">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
          </div>
        )}
        {!isLoading && (messages ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            Nenhuma mensagem ainda. Envie a primeira.
          </p>
        )}
        {(messages ?? []).map((m) => {
          if (m.is_system) {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-background border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground max-w-[85%]">
                  <Wrench className="size-3 shrink-0 text-primary" />
                  <span className="truncate">{m.content}</span>
                  <span className="opacity-70">{formatStamp(m.created_at)}</span>
                </div>
              </div>
            );
          }
          const mine = m.sender_user_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 space-y-2 shadow-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/60 rounded-bl-md",
                )}
              >
                {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                {m.attachments.length > 0 && (
                  <div className="space-y-2">
                    {m.attachments.map((a) => (
                      <AttachmentChip key={a.path} attachment={a} />
                    ))}
                  </div>
                )}
                <div className={cn("text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {formatStamp(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 p-3 space-y-2 shrink-0 bg-card">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px]"
              >
                {f.type.startsWith("image/") ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
                <span className="truncate max-w-[140px]">{f.name}</span>
                <button
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  aria-label={`Remover ${f.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => {
              setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5));
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Escreva uma mensagem"
            className="min-h-10 max-h-32 resize-none"
          />
          <Button
            size="icon"
            onClick={() => void submit()}
            disabled={send.isPending || (!text.trim() && files.length === 0)}
            aria-label="Enviar"
          >
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatArea() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useChatRealtime(null);

  const all = conversations ?? [];
  const active = all.find((c) => c.id === activeId) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (c) =>
          c.counterpartName.toLowerCase().includes(q) ||
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.last_message_preview ?? "").toLowerCase().includes(q),
      )
    : all;

  return (
    <Card className="overflow-hidden flex h-[calc(100dvh-15rem)] min-h-[420px] max-h-[860px] p-0 gap-0">
      <div
        className={cn(
          "w-full md:w-80 md:border-r border-border/60 flex flex-col min-h-0 shrink-0",
          active && "hidden md:flex",
        )}
      >
        <div className="p-3 border-b border-border/60 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar conversa"
              aria-label="Pesquisar conversa"
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {isError ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
              <p>Não foi possível carregar suas conversas.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : !isLoading && all.length > 0 && filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa encontrada para “{query}”.
            </p>
          ) : (
            <ConversationList
              conversations={filtered}
              activeId={activeId}
              onSelect={(c) => setActiveId(c.id)}
              loading={isLoading}
            />
          )}
        </div>
      </div>

      <div className={cn("flex-1 min-w-0 min-h-0", !active && "hidden md:flex md:items-center md:justify-center")}>
        {active ? (
          <Thread conversation={active} onBack={() => setActiveId(null)} />
        ) : (
          <div className="text-center text-sm text-muted-foreground p-8">
            <MessageSquare className="size-10 mx-auto mb-3 opacity-30" />
            Selecione uma conversa para começar.
          </div>
        )}
      </div>
    </Card>
  );
}
