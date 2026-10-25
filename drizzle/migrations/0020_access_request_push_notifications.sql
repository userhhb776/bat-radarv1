CREATE OR REPLACE FUNCTION public.notify_pending_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  notification_id uuid;
  scheduler_token text;
BEGIN
  IF NEW.approval_status <> 'pending' THEN RETURN NEW; END IF;
  SELECT token INTO scheduler_token FROM public.cron_tokens WHERE name = 'scheduler';
  FOR recipient IN
    SELECT p.id FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.id
    WHERE r.role = 'admin' AND p.approval_status = 'approved'
  LOOP
    INSERT INTO public.notifications(user_id, title, body, url)
    VALUES (recipient, 'Nova solicitação de acesso', NEW.name || ' solicitou uma conta. Abra o ACESS para analisar.', '/acess')
    RETURNING id INTO notification_id;
    BEGIN
      IF scheduler_token IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://project--630b7e1b-b5e9-450e-a09f-ee7087d788d3.lovable.app/api/public/hooks/access-request',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || scheduler_token),
          body := jsonb_build_object('notificationId', notification_id),
          timeout_milliseconds := 30000
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Access request push could not be queued: %', SQLERRM;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_pending_access_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_pending_access_request() TO service_role;
CREATE TRIGGER pending_access_request_notification
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_pending_access_request();