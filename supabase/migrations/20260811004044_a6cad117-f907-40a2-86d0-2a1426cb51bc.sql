REVOKE SELECT (commission_rate), UPDATE (commission_rate) ON public.profiles FROM authenticated;
REVOKE SELECT (commission_rate), UPDATE (commission_rate) ON public.profiles FROM anon;
GRANT ALL ON public.profiles TO service_role;