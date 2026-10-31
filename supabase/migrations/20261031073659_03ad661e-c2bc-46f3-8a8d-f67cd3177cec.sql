CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  mission text NOT NULL DEFAULT '',
  offer text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  ideal_client text NOT NULL DEFAULT '',
  learned text NOT NULL DEFAULT '',
  instance text NOT NULL DEFAULT '',
  ai_provider text NOT NULL DEFAULT 'native',
  ai_key text,
  model text NOT NULL DEFAULT 'gpt-oss:120b',
  active boolean NOT NULL DEFAULT false,
  auto_reply boolean NOT NULL DEFAULT true,
  training_mode boolean NOT NULL DEFAULT false,
  training_phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agents" ON public.agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "approved only" ON public.agents AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE TRIGGER agents_updated BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  direction text NOT NULL,
  body text NOT NULL,
  hot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_messages_idx ON public.agent_messages (agent_id, phone, created_at DESC);
GRANT SELECT, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent msgs read" ON public.agent_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own agent msgs del" ON public.agent_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Modo treinamento é exclusivo do administrador
CREATE OR REPLACE FUNCTION public.agents_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.training_mode AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Modo treinamento é exclusivo do administrador';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN NEW.training_phone := ''; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agents_guard BEFORE INSERT OR UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.agents_guard();