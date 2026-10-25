REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.access_events FROM anon, authenticated;
REVOKE SELECT ON public.profiles, public.user_roles, public.access_events FROM anon;
GRANT SELECT ON public.profiles, public.user_roles, public.access_events TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.access_events TO service_role;