CREATE TABLE public.scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  niche text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'primeiro_contato',
  site_filter text NOT NULL DEFAULT 'todos',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own scripts" ON public.scripts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads ADD COLUMN script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN next_followup_at date;
ALTER TABLE public.leads ADD COLUMN last_contact_at timestamptz;