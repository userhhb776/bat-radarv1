CREATE TABLE public.service_config (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.service_config TO service_role;
ALTER TABLE public.service_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.db_usage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'bytes', pg_database_size(current_database()),
    'tables', (SELECT coalesce(jsonb_agg(t ORDER BY t.bytes DESC), '[]'::jsonb) FROM (
      SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes, c.reltuples::bigint AS rows
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 2 DESC LIMIT 8) t)
  );
END $$;
REVOKE ALL ON FUNCTION public.db_usage() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.db_usage() TO authenticated;