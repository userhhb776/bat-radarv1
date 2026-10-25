CREATE TABLE public.mining_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  place_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('descartado','salvo')),
  name text,
  niche text,
  rating numeric,
  reviews_count integer NOT NULL DEFAULT 0,
  website text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mining_feedback TO authenticated;
GRANT ALL ON public.mining_feedback TO service_role;
ALTER TABLE public.mining_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.mining_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());