import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ChatAttachment = {
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  is_system: boolean;
  content: string;
  attachments: ChatAttachment[];
  maintenance_id: string | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  kind: "tenant_manager" | "tenant_landlord" | "landlord_manager";
  contract_id: string | null;
  property_id: string | null;
  title: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  /** contraparte(s) da conversa */
  counterpartName: string;
  counterpartAvatar: string | null;
  counterpartRole: string;
  unreadCount: number;
  lastReadAt: string | null;
};

const roleLabels: Record<string, string> = {
  inquilino: "Inquilino",
  imobiliaria: "Imobiliária",
  proprietario: "Proprietário",
  membro: "Participante",
};

export function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}

/** Lista de conversas do usuário logado, já com contraparte e não lidas. */
export function useConversations() {
  const { user } = useAuth();
  const uid = user?.id;

  return useQuery({
    queryKey: ["chat", "conversations", uid],
    enabled: !!uid,
    queryFn: async (): Promise<ChatConversation[]> => {
      // Garante que as conversas existam para os contratos ativos
      await supabase.rpc("ensure_chat_conversations");

      const { data: parts, error: partsErr } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id, role_label, last_read_at");
      if (partsErr) throw partsErr;

      const mine = (parts ?? []).filter((p) => p.user_id === uid);
      if (mine.length === 0) return [];
      const convIds = mine.map((p) => p.conversation_id);

      const { data: convs, error: convErr } = await supabase
        .from("chat_conversations")
        .select("id, kind, contract_id, property_id, title, last_message_at, last_message_preview")
        .in("id", convIds);
      if (convErr) throw convErr;

      const others = (parts ?? []).filter(
        (p) => p.user_id !== uid && convIds.includes(p.conversation_id),
      );
      const otherIds = Array.from(new Set(others.map((p) => p.user_id)));

      const { data: profiles } = otherIds.length
        ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", otherIds)
        : { data: [] as any[] };

      // contagem de não lidas
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("conversation_id, created_at, sender_user_id")
        .in("conversation_id", convIds);

      const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      return (convs ?? [])
        .map((c): ChatConversation => {
          const me = mine.find((p) => p.conversation_id === c.id)!;
          const other = others.find((p) => p.conversation_id === c.id);
          const prof = other ? profileById.get(other.user_id) : null;
          const unreadCount = (msgs ?? []).filter(
            (m) =>
              m.conversation_id === c.id &&
              m.sender_user_id !== uid &&
              (!me.last_read_at || new Date(m.created_at) > new Date(me.last_read_at)),
          ).length;

          return {
            id: c.id,
            kind: c.kind as ChatConversation["kind"],
            contract_id: c.contract_id,
            property_id: c.property_id,
            title: c.title,
            last_message_at: c.last_message_at,
            last_message_preview: c.last_message_preview,
            counterpartName: prof?.full_name || prof?.email || "Participante",
            counterpartAvatar: prof?.avatar_url ?? null,
            counterpartRole: roleLabel(other?.role_label ?? "membro"),
            unreadCount,
            lastReadAt: me.last_read_at,
          };
        })
        .sort((a, b) =>
          (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
        );
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        attachments: Array.isArray(m.attachments) ? (m.attachments as ChatAttachment[]) : [],
      }));
    },
  });
}

/** Inscrição realtime nas mensagens do usuário. */
export function useChatRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const channel = supabase
      .channel(`chat-messages-${conversationId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row: any = payload.new;
          queryClient.invalidateQueries({ queryKey: ["chat", "conversations", user?.id] });
          if (conversationId && row?.conversation_id === conversationId) {
            queryClient.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, conversationId, user?.id]);
}

export function useSendMessage(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      files,
    }: {
      content: string;
      files?: File[];
    }) => {
      if (!conversationId || !user) throw new Error("Conversa inválida");

      const attachments: ChatAttachment[] = [];
      for (const file of files ?? []) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${conversationId}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("chat-attachments")
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        attachments.push({
          path,
          name: file.name,
          mime: file.type || null,
          size: file.size ?? null,
        });
      }

      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        content: content.trim(),
        attachments: attachments as any,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations", user?.id] });
    },
  });
}

export function useMarkRead(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !user) return;
    (async () => {
      await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations", user.id] });
    })();
  }, [conversationId, user?.id]);
}

export function useTotalUnread() {
  const { data } = useConversations();
  return useMemo(() => (data ?? []).reduce((acc, c) => acc + c.unreadCount, 0), [data]);
}

/** URL assinada para baixar/visualizar um anexo privado. */
export async function getAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
