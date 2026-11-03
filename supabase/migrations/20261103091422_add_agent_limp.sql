ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS limp jsonb NOT NULL DEFAULT '{"enabled": false, "entries": []}'::jsonb;

COMMENT ON COLUMN public.agents.limp IS
  'LIMP: regras configuráveis de mensagens/assuntos que devem ser ignorados antes do B-T6X e da IA.';
