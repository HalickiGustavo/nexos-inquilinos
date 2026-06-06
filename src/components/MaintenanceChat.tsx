import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
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
  created_at: string;
};

export function MaintenanceChat({ maintenanceId }: { maintenanceId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
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
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("maintenance_messages").insert({
        maintenance_id: maintenanceId,
        sender_user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["maint-msgs", maintenanceId] });
    },
  });

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
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={cn("text-[10px] mt-1 opacity-70")}>
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
      <form
        className="flex gap-2 p-3 border-t bg-background"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          send.mutate(trimmed);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={send.isPending}
        />
        <Button type="submit" size="icon" disabled={send.isPending || !text.trim()}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
