-- ============ limpeza do chatbot ============
DROP TABLE IF EXISTS public.support_chat_messages CASCADE;

-- ============ colunas auxiliares ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.maintenances ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros';

-- ============ conversas ============
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('tenant_manager','tenant_landlord','landlord_manager')),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX chat_conversations_contract_kind_uidx
  ON public.chat_conversations (contract_id, kind) WHERE contract_id IS NOT NULL;

CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_label text NOT NULL DEFAULT 'membro',
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX chat_participants_user_idx ON public.chat_participants (user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid,
  is_system boolean NOT NULL DEFAULT false,
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance_id uuid REFERENCES public.maintenances(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_created_idx ON public.chat_messages (conversation_id, created_at);

GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT, UPDATE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- ============ helper ============
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants p
    WHERE p.conversation_id = _conversation_id AND p.user_id = _user_id
  )
$$;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conversations_select_participant" ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.is_chat_participant(id, auth.uid()));

CREATE POLICY "chat_participants_select_participant" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "chat_participants_update_own" ON public.chat_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_messages_select_participant" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "chat_messages_insert_participant" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND is_system = false
    AND public.is_chat_participant(conversation_id, auth.uid())
  );

-- ============ manter resumo da conversa ============
CREATE OR REPLACE FUNCTION public.chat_touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = CASE
           WHEN coalesce(NEW.content, '') <> '' THEN left(NEW.content, 140)
           WHEN jsonb_array_length(NEW.attachments) > 0 THEN 'Anexo enviado'
           ELSE 'Mensagem'
         END,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_chat_touch_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_touch_conversation();

-- ============ criação automática de conversas ============
CREATE OR REPLACE FUNCTION public.ensure_chat_conversations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT c.id AS contract_id,
           c.property_id,
           c.user_id AS manager_user_id,
           t.user_id_link AS tenant_user_id,
           p.landlord_id,
           coalesce(p.nickname, p.address) AS property_label
      FROM public.contracts c
      JOIN public.properties p ON p.id = c.property_id
      LEFT JOIN public.tenants t ON t.id = c.tenant_id
     WHERE c.deleted_at IS NULL
       AND (c.user_id = v_uid OR t.user_id_link = v_uid OR p.landlord_id = v_uid)
  LOOP
    -- inquilino <-> imobiliária/gestor
    IF r.tenant_user_id IS NOT NULL AND r.manager_user_id IS NOT NULL
       AND r.tenant_user_id <> r.manager_user_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'tenant_manager';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('tenant_manager', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.tenant_user_id, 'inquilino'), (v_conv, r.manager_user_id, 'imobiliaria')
      ON CONFLICT DO NOTHING;
    END IF;

    -- inquilino <-> proprietário
    IF r.tenant_user_id IS NOT NULL AND r.landlord_id IS NOT NULL
       AND r.tenant_user_id <> r.landlord_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'tenant_landlord';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('tenant_landlord', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.tenant_user_id, 'inquilino'), (v_conv, r.landlord_id, 'proprietario')
      ON CONFLICT DO NOTHING;
    END IF;

    -- proprietário <-> imobiliária
    IF r.landlord_id IS NOT NULL AND r.manager_user_id IS NOT NULL
       AND r.landlord_id <> r.manager_user_id THEN
      SELECT id INTO v_conv FROM public.chat_conversations
       WHERE contract_id = r.contract_id AND kind = 'landlord_manager';
      IF v_conv IS NULL THEN
        INSERT INTO public.chat_conversations (kind, contract_id, property_id, title)
        VALUES ('landlord_manager', r.contract_id, r.property_id, r.property_label)
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.chat_participants (conversation_id, user_id, role_label)
      VALUES (v_conv, r.landlord_id, 'proprietario'), (v_conv, r.manager_user_id, 'imobiliaria')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_chat_conversations() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_chat_conversations() TO authenticated;

-- ============ manutenções refletidas no chat ============
CREATE OR REPLACE FUNCTION public.chat_broadcast_maintenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_text text;
  v_conv record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_text := 'Nova solicitação de manutenção: ' || NEW.title || ' (urgência: ' || NEW.priority || ')';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_text := 'Manutenção "' || NEW.title || '" atualizada para: ' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  FOR v_conv IN
    SELECT id FROM public.chat_conversations
     WHERE (NEW.contract_id IS NOT NULL AND contract_id = NEW.contract_id)
        OR (NEW.contract_id IS NULL AND property_id = NEW.property_id)
  LOOP
    INSERT INTO public.chat_messages (conversation_id, sender_user_id, is_system, content, maintenance_id)
    VALUES (v_conv.id, NULL, true, v_text, NEW.id);
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_chat_broadcast_maintenance
AFTER INSERT OR UPDATE ON public.maintenances
FOR EACH ROW EXECUTE FUNCTION public.chat_broadcast_maintenance();

-- ============ realtime ============
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- ============ storage: anexos do chat ============
CREATE POLICY "chat_attachments_select_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_chat_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "chat_attachments_insert_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_chat_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );