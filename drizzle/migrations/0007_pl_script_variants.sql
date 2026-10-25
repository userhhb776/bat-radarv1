ALTER TABLE public.pl_scripts ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[[],[],[]]'::jsonb;
ALTER TABLE public.pl_campaigns ADD COLUMN IF NOT EXISTS max_contacts integer;