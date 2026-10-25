CREATE TABLE IF NOT EXISTS public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.cron_tokens FROM anon, authenticated;
GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.cron_tokens IS 'Server-only tokens for pg_cron -> /api/public/hooks/* calls. No client access.';