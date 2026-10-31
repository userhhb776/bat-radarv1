ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS style text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pace text NOT NULL DEFAULT 'equilibrado',
  ADD COLUMN IF NOT EXISTS script_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS miner jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;
GRANT INSERT ON public.agent_messages TO authenticated;
CREATE POLICY "own agent msgs ins" ON public.agent_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agent_audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  trigger text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'audio/ogg',
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_audios TO authenticated;
GRANT ALL ON public.agent_audios TO service_role;
ALTER TABLE public.agent_audios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audios" ON public.agent_audios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "approved only" ON public.agent_audios AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));

CREATE TABLE public.agent_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  website text,
  rating numeric,
  reviews_count int NOT NULL DEFAULT 0,
  niche text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  maps_url text,
  status text NOT NULL DEFAULT 'novo',
  send_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, place_id)
);
CREATE INDEX agent_leads_queue_idx ON public.agent_leads (status, send_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_leads TO authenticated;
GRANT ALL ON public.agent_leads TO service_role;
ALTER TABLE public.agent_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent leads" ON public.agent_leads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "approved only" ON public.agent_leads AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE TRIGGER agent_leads_updated BEFORE UPDATE ON public.agent_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_events_idx ON public.agent_events (agent_id, created_at DESC);
GRANT SELECT, DELETE ON public.agent_events TO authenticated;
GRANT ALL ON public.agent_events TO service_role;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent events" ON public.agent_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own agent events del" ON public.agent_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.agent_pauses (
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  phone text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, phone)
);
GRANT SELECT, INSERT, DELETE ON public.agent_pauses TO authenticated;
GRANT ALL ON public.agent_pauses TO service_role;
ALTER TABLE public.agent_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pauses" ON public.agent_pauses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);