-- lovable-cron-fallback-reviewed: campaign sends must leave within each scheduled window; 18-min tick plus one-shot wake alarms is the established design
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ DECLARE j text; BEGIN
  FOREACH j IN ARRAY ARRAY['wa-dispatch','inactivity-reminder','daily-mining'] LOOP
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = j;
  END LOOP;
END $$;
SELECT cron.schedule('wa-dispatch', '*/18 * * * *', $c$select net.http_post(url:='https://bat-radarv1.lovable.app/api/public/hooks/wa-dispatch', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')), body:='{}'::jsonb, timeout_milliseconds:=120000);$c$);
SELECT cron.schedule('inactivity-reminder', '7 * * * *', $c$select net.http_post(url:='https://bat-radarv1.lovable.app/api/public/hooks/inactivity-reminder', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')), body:='{}'::jsonb, timeout_milliseconds:=60000);$c$);
SELECT cron.schedule('daily-mining', '0 5 * * *', $c$select net.http_post(url:='https://bat-radarv1.lovable.app/api/public/hooks/daily-mining', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')), body:='{}'::jsonb, timeout_milliseconds:=120000);$c$);

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
  url:='https://bat-radarv1.lovable.app/api/public/hooks/wa-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=120000);$c$, jname);
  PERFORM cron.schedule(jname, sched, cmd);
  RETURN jname;
END; $fn$;
REVOKE ALL ON FUNCTION public.schedule_dispatch_wake(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_dispatch_wake(timestamptz) TO service_role;