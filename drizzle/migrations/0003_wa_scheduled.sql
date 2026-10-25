CREATE TABLE public.wa_scheduled (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  instance text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  texts text[] NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wa_scheduled_due_idx ON public.wa_scheduled(status, send_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_scheduled TO authenticated;
GRANT ALL ON public.wa_scheduled TO service_role;
ALTER TABLE public.wa_scheduled ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled" ON public.wa_scheduled FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());