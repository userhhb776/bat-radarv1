CREATE TABLE public.ad_spy_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  mode text NOT NULL DEFAULT 'ofertas' CHECK (mode IN ('empresas','ofertas')),
  ad_id text NOT NULL,
  page_name text, page_id text, body text, title text, cta text,
  link_url text, image_url text, video_url text, platforms text[],
  start_date timestamptz, is_active boolean, country text, keyword text, notes text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_spy_saved TO authenticated;
GRANT ALL ON public.ad_spy_saved TO service_role;
ALTER TABLE public.ad_spy_saved ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ad_spy_saved" ON public.ad_spy_saved FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);