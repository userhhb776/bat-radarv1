CREATE TABLE public.daily_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  place_id text NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  website text,
  rating numeric,
  reviews_count integer NOT NULL DEFAULT 0,
  niche text,
  city text,
  maps_url text,
  found_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Rio_Branco')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);
GRANT SELECT, DELETE ON public.daily_leads TO authenticated;
GRANT ALL ON public.daily_leads TO service_role;
ALTER TABLE public.daily_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own daily leads read" ON public.daily_leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own daily leads delete" ON public.daily_leads FOR DELETE TO authenticated USING (auth.uid() = user_id);