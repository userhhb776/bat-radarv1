ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS agent_messages_provider_message_uidx
  ON public.agent_messages (agent_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
