CREATE TABLE public.support_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  client_message_id text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.support_chat_messages TO authenticated;
GRANT ALL ON public.support_chat_messages TO service_role;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own support chat"
  ON public.support_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support chat"
  ON public.support_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own support chat"
  ON public.support_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_support_chat_user_created ON public.support_chat_messages (user_id, created_at);

CREATE TRIGGER support_chat_messages_set_updated_at
  BEFORE UPDATE ON public.support_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();