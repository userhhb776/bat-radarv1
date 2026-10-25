-- lovable-cron-fallback-reviewed: user asked to reduce the dispatcher from every 5 to every 18 minutes (80 runs/day) to save Cloud usage; scheduled sends at arbitrary future times still need a time-based check.
SELECT cron.unschedule('wa-dispatch-5min');
SELECT cron.schedule('wa-dispatch-18min', '*/18 * * * *', $c$
select net.http_post(
  url:='https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/wa-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=120000);
$c$);
ALTER TABLE public.pl_queue ADD COLUMN IF NOT EXISTS replied boolean NOT NULL DEFAULT false;