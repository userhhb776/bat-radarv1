-- lovable-cron-fallback-reviewed: replaces the existing 5-min WhatsApp dispatcher (same cadence) only to fix its auth token; scheduled sends at arbitrary future times need a time-based check.
SELECT cron.schedule('wa-dispatch-5min', '*/5 * * * *', $c$
select net.http_post(
  url:='https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/wa-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=60000);
$c$);
SELECT cron.schedule('inactivity-reminder-hourly', '0 * * * *', $c$
select net.http_post(
  url:='https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/inactivity-reminder',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=60000);
$c$);
SELECT cron.schedule('daily-mining-midnight', '0 5 * * *', $c$
select net.http_post(
  url:='https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/daily-mining',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select token from public.cron_tokens where name='scheduler')),
  body:='{}'::jsonb, timeout_milliseconds:=120000);
$c$);