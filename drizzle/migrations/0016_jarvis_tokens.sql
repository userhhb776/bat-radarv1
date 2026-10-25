CREATE TABLE public.jarvis_tokens (
  user_id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, DELETE ON public.jarvis_tokens TO authenticated;
GRANT ALL ON public.jarvis_tokens TO service_role;
ALTER TABLE public.jarvis_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own token read" ON public.jarvis_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own token delete" ON public.jarvis_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);