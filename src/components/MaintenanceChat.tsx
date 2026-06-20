import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Paperclip, X, FileText, FileVideo, Image as ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  maintenance_id: string;
  sender_user_id: string;
  content: string;
  attachment_urls?: string[] | null;
  created_at: string;
};

const BUCKET = "maintenance-evidence";

export function MaintenanceChat({ maintenanceId }: { maintenanceId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["maint-msgs", maintenanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_messages")
        .select("*")
        .eq("maintenance_id", maintenanceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`mm:${maintenanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "maintenance_messages",
          filter: `maintenance_id=eq.${maintenanceId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["maint-msgs", maintenanceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [maintenanceId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content && attachments.length === 0) return;
      const { error } = await supabase.from("maintenance_messages").insert({
        maintenance_id: maintenanceId,
        sender_user_id: user!.id,
        content,
        attachment_urls: attachments,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["maint-msgs", maintenanceId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const f of Array.from(files)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name}: arquivo maior que 20MB`);
          continue;
        }
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${user.id}/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
          contentType: f.type,
          upsert: false,
        });
        if (error) throw error;
        added.push(path);
      }
      setAttachments((prev) => [...prev, ...added]);
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-card border rounded-lg overflow-hidden">
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem ainda. Comece a conversa abaixo.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender_user_id === user?.id;
              const atts = m.attachment_urls ?? [];
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm space-y-2",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm",
                    )}
                  >
                    {atts.length > 0 && (
                      <div className="space-y-1.5">
                        {atts.map((p) => (
                          <AttachmentPreview key={p} path={p} mine={mine} />
                        ))}
                      </div>
                    )}
                    {m.content && (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                    <p className={cn("text-[10px] opacity-70")}>
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {attachments.length > 0 && (
        <div className="p-2 border-t bg-muted/30 flex flex-wrap gap-2">
          {attachments.map((p) => (
            <PendingChip
              key={p}
              path={p}
              onRemove={() => setAttachments((prev) => prev.filter((x) => x !== p))}
            />
          ))}
        </div>
      )}

      <form
        className="flex gap-2 p-3 border-t bg-background"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() && attachments.length === 0) return;
          send.mutate();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={uploading || send.isPending}
          onClick={() => fileRef.current?.click()}
          title="Anexar arquivo"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={send.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={send.isPending || (!text.trim() && attachments.length === 0)}
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

function fileKind(path: string): "image" | "video" | "doc" {
  if (/\.(png|jpe?g|gif|webp|heic|avif)$/i.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return "video";
  return "doc";
}

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function AttachmentPreview({ path, mine }: { path: string; mine: boolean }) {
  const url = useSignedUrl(path);
  const kind = fileKind(path);
  const name = path.split("/").pop() ?? "arquivo";

  if (!url) {
    return (
      <div className="h-20 grid place-items-center rounded-md bg-black/10">
        <Loader2 className="size-4 animate-spin opacity-70" />
      </div>
    );
  }
  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={url} alt={name} className="rounded-md max-h-56 max-w-full h-auto object-cover" />
      </a>
    );
  }
  if (kind === "video") {
    return <video src={url} controls className="rounded-md max-h-56 w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
        mine ? "bg-primary-foreground/15" : "bg-background/60 border",
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="truncate flex-1">{name}</span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function PendingChip({ path, onRemove }: { path: string; onRemove: () => void }) {
  const kind = fileKind(path);
  const Icon = kind === "image" ? ImageIcon : kind === "video" ? FileVideo : FileText;
  const name = path.split("/").pop() ?? "arquivo";
  return (
    <div className="flex items-center gap-1.5 bg-card border rounded-full pl-2 pr-1 py-1 text-xs max-w-[200px]">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="size-5 grid place-items-center rounded-full hover:bg-muted shrink-0"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
