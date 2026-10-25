ALTER TABLE public.leads ADD COLUMN source_url text;
COMMENT ON COLUMN public.leads.source_url IS 'Link da página onde o lead externo foi encontrado';