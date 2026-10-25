CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL, niche text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT 'primeiro_contato',
  site_filter text NOT NULL DEFAULT 'todos', body text NOT NULL,
  message2 text NOT NULL DEFAULT '', message3 text NOT NULL DEFAULT '',
  variants jsonb NOT NULL DEFAULT '[[], [], []]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated; GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own scripts" ON public.scripts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  place_id text NOT NULL, name text NOT NULL, phone text, address text, website text,
  rating numeric, reviews_count integer, niche text, city text, maps_url text,
  status text NOT NULL DEFAULT 'novo', audit jsonb, message text, notes text,
  delivered_site_url text, delivered_at timestamptz,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  next_followup_at date, last_contact_at timestamptz,
  source text NOT NULL DEFAULT 'batradar', instagram text, tags text[] NOT NULL DEFAULT '{}', source_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated; GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own leads" ON public.leads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  deadline text NOT NULL DEFAULT '', payment_terms text NOT NULL DEFAULT '', scope text NOT NULL DEFAULT '',
  completed_work text NOT NULL DEFAULT '',
  received_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  project_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (project_cost >= 0),
  outcome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated; GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own proposals for own leads" ON public.proposals FOR ALL TO authenticated USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_id AND leads.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_id AND leads.user_id = auth.uid()));
CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.site_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  place_id text NOT NULL, business_name text NOT NULL, niche text, city text, prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_prompts TO authenticated; GRANT ALL ON public.site_prompts TO service_role;
ALTER TABLE public.site_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own prompts" ON public.site_prompts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  place_id text NOT NULL, name text NOT NULL, phone text, address text, website text, rating numeric,
  reviews_count integer NOT NULL DEFAULT 0, niche text, city text, maps_url text,
  found_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Rio_Branco')::date,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, place_id)
);
GRANT SELECT, DELETE ON public.daily_leads TO authenticated; GRANT ALL ON public.daily_leads TO service_role;
ALTER TABLE public.daily_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own daily leads read" ON public.daily_leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own daily leads delete" ON public.daily_leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY, mining_enabled boolean NOT NULL DEFAULT true, niche_filter text, state_filter text,
  last_active_at timestamptz, last_reminder_at timestamptz, wa_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated; GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, endpoint text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated; GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL, body text NOT NULL,
  url text NOT NULL DEFAULT '/diarios', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lead_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, niche text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_blocks TO authenticated; GRANT ALL ON public.lead_blocks TO service_role;
ALTER TABLE public.lead_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.lead_blocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.block_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  block_id uuid NOT NULL REFERENCES public.lead_blocks(id) ON DELETE CASCADE,
  place_id text NOT NULL, name text NOT NULL, phone text, address text, website text, rating numeric,
  reviews_count integer NOT NULL DEFAULT 0, niche text, city text, maps_url text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (block_id, place_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_items TO authenticated; GRANT ALL ON public.block_items TO service_role;
ALTER TABLE public.block_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own block items" ON public.block_items FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.lead_blocks b WHERE b.id = block_id AND b.user_id = auth.uid()));

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL,
  block_id uuid REFERENCES public.lead_blocks(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  instance text NOT NULL, texts text[] NOT NULL DEFAULT '{}',
  msg_gap_s integer NOT NULL DEFAULT 30, min_gap_s integer NOT NULL DEFAULT 180, max_gap_s integer NOT NULL DEFAULT 420,
  start_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'ativa',
  from_h integer NOT NULL DEFAULT 8, to_h integer NOT NULL DEFAULT 18, days integer[] NOT NULL DEFAULT '{1,2,3,4,5}', daily_limit integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated; GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wa_scheduled (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), instance text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL, phone text NOT NULL, texts text[] NOT NULL, send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente', error text, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wa_scheduled_due_idx ON public.wa_scheduled(status, send_at);
CREATE INDEX wa_scheduled_campaign_idx ON public.wa_scheduled(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_scheduled TO authenticated; GRANT ALL ON public.wa_scheduled TO service_role;
ALTER TABLE public.wa_scheduled ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled" ON public.wa_scheduled FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.mining_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), place_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('descartado','salvo','visto')),
  name text, niche text, rating numeric, reviews_count integer NOT NULL DEFAULT 0, website text, address text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, place_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mining_feedback TO authenticated; GRANT ALL ON public.mining_feedback TO service_role;
ALTER TABLE public.mining_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.mining_feedback FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.jarvis_tokens (
  user_id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz
);
GRANT SELECT, DELETE ON public.jarvis_tokens TO authenticated; GRANT ALL ON public.jarvis_tokens TO service_role;
ALTER TABLE public.jarvis_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own token read" ON public.jarvis_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own token delete" ON public.jarvis_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.cron_tokens FROM anon, authenticated;
GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.cron_tokens(name) VALUES ('scheduler') ON CONFLICT DO NOTHING;

-- Papa Lead
CREATE TABLE public.pl_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, source text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pl_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  list_id uuid NOT NULL REFERENCES public.pl_lists(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '', phone text NOT NULL, notes text NOT NULL DEFAULT '', opted_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pl_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL, body text NOT NULL, message2 text NOT NULL DEFAULT '', message3 text NOT NULL DEFAULT '',
  variants jsonb NOT NULL DEFAULT '[[],[],[]]'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pl_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL,
  list_id uuid REFERENCES public.pl_lists(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.pl_scripts(id) ON DELETE SET NULL,
  instance text NOT NULL, texts text[] NOT NULL DEFAULT '{}',
  daily_limit integer NOT NULL DEFAULT 0, max_contacts integer,
  min_gap_min integer NOT NULL DEFAULT 3, max_gap_min integer NOT NULL DEFAULT 7,
  window_start integer NOT NULL DEFAULT 8, window_end integer NOT NULL DEFAULT 18, weekdays_only boolean NOT NULL DEFAULT true,
  start_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'ativa', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pl_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id uuid NOT NULL REFERENCES public.pl_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.pl_contacts(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '', phone text NOT NULL, texts text[] NOT NULL, send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente', error text, sent_at timestamptz, replied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pl_queue_due_idx ON public.pl_queue(status, send_at);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['pl_lists','pl_contacts','pl_scripts','pl_campaigns','pl_queue'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
END LOOP; END $$;

-- Approval gate + audit
CREATE OR REPLACE FUNCTION public.audit_account_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r jsonb; u uuid; BEGIN r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; u:=(r->>'user_id')::uuid; IF auth.uid() IS NOT NULL AND u IS NOT NULL THEN INSERT INTO public.access_events(user_id,kind,page,detail,user_agent) VALUES(auth.uid(),lower(TG_OP),TG_TABLE_NAME,jsonb_build_object('id',r->>'id','name',coalesce(r->>'name',r->>'title'),'status',r->>'status'),left(coalesce((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'user-agent',''),500)); END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END $$;
REVOKE ALL ON FUNCTION public.audit_account_changes() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['leads','proposals','site_prompts','scripts','daily_leads','user_settings','push_subscriptions','notifications','wa_scheduled','lead_blocks','block_items','campaigns','pl_lists','pl_contacts','pl_scripts','pl_campaigns','pl_queue','mining_feedback','jarvis_tokens'] LOOP EXECUTE format('CREATE POLICY "approved accounts only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()))',t); IF t NOT IN ('jarvis_tokens','push_subscriptions','user_settings') THEN EXECUTE format('CREATE TRIGGER account_activity_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_account_changes()',t); END IF; END LOOP; END $$;

-- Dispatch wake (single-use alarm for the WhatsApp dispatcher)
CREATE OR REPLACE FUNCTION public.schedule_dispatch_wake(_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $fn$
DECLARE
  t timestamptz := date_trunc('minute', _at) + CASE WHEN _at > date_trunc('minute', _at) THEN interval '1 minute' ELSE interval '0' END;
  jname text; sched text; cmd text;
BEGIN
  IF t <= now() THEN t := date_trunc('minute', now()) + interval '1 minute'; END IF;
  IF extract(minute FROM t AT TIME ZONE 'UTC')::int % 18 = 0 THEN RETURN 'tick'; END IF;
  jname := 'wa-wake-' || to_char(t AT TIME ZONE 'UTC', 'MMDDHH24MI');
  sched := format('%s %s %s %s *',
    extract(minute FROM t AT TIME ZONE 'UTC')::int, extract(hour FROM t AT TIME ZONE 'UTC')::int,
    extract(day FROM t AT TIME ZONE 'UTC')::int, extract(month FROM t AT TIME ZONE 'UTC')::int);
  cmd := format($c$select cron.unschedule(%L); select net.http_post(
  url:='https://project--3c8017e9-b002-415c-a405-9d36fedd8639.lovable.app/api/public/hooks/wa-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=120000);$c$, jname);
  PERFORM cron.schedule(jname, sched, cmd);
  RETURN jname;
END; $fn$;
REVOKE ALL ON FUNCTION public.schedule_dispatch_wake(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_dispatch_wake(timestamptz) TO service_role;