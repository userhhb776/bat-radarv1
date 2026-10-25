CREATE OR REPLACE FUNCTION public.schedule_dispatch_wake(_at timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $fn$
DECLARE
  t timestamptz := date_trunc('minute', _at) + CASE WHEN _at > date_trunc('minute', _at) THEN interval '1 minute' ELSE interval '0' END;
  jname text;
  sched text;
  cmd text;
BEGIN
  IF t <= now() THEN t := date_trunc('minute', now()) + interval '1 minute'; END IF;
  -- os minutos 0, 18, 36 e 54 já têm a rodada fixa
  IF extract(minute FROM t AT TIME ZONE 'UTC')::int % 18 = 0 THEN RETURN 'tick'; END IF;
  jname := 'wa-wake-' || to_char(t AT TIME ZONE 'UTC', 'MMDDHH24MI');
  sched := format('%s %s %s %s *',
    extract(minute FROM t AT TIME ZONE 'UTC')::int, extract(hour FROM t AT TIME ZONE 'UTC')::int,
    extract(day FROM t AT TIME ZONE 'UTC')::int, extract(month FROM t AT TIME ZONE 'UTC')::int);
  cmd := format($c$select cron.unschedule(%L); select net.http_post(
  url:='https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/wa-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=120000);$c$, jname);
  PERFORM cron.schedule(jname, sched, cmd);
  RETURN jname;
END;
$fn$;

REVOKE ALL ON FUNCTION public.schedule_dispatch_wake(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_dispatch_wake(timestamptz) TO service_role;