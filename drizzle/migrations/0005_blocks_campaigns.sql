ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS message2 text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS message3 text NOT NULL DEFAULT '';

CREATE TABLE public.lead_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  niche text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_blocks TO authenticated;
GRANT ALL ON public.lead_blocks TO service_role;
ALTER TABLE public.lead_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.lead_blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.block_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  block_id uuid NOT NULL REFERENCES public.lead_blocks(id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, place_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_items TO authenticated;
GRANT ALL ON public.block_items TO service_role;
ALTER TABLE public.block_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own block items" ON public.block_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.lead_blocks b WHERE b.id = block_id AND b.user_id = auth.uid()));

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  block_id uuid REFERENCES public.lead_blocks(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  instance text NOT NULL,
  texts text[] NOT NULL DEFAULT '{}',
  msg_gap_s integer NOT NULL DEFAULT 30,
  min_gap_s integer NOT NULL DEFAULT 180,
  max_gap_s integer NOT NULL DEFAULT 420,
  start_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.wa_scheduled ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS wa_scheduled_campaign_idx ON public.wa_scheduled(campaign_id);