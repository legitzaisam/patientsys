-- Phase 6 — login throttle and step-up challenges.
--
-- Failed sign-ins happen before a session exists, so they cannot go through
-- clinic.functions.ts (every handler requires a JWT). These two functions are
-- the only public.rpc surface callable by anon, and they write only to their
-- own tables. Nothing else is granted.

CREATE TABLE public.auth_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  surface text NOT NULL CHECK (surface IN ('staff', 'patient')),
  success boolean NOT NULL,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_login_events_email_created_idx
  ON public.auth_login_events (email, created_at DESC);

CREATE TABLE public.auth_step_up (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.auth_login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_step_up ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_login_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_step_up FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_login_throttle(p_email text, p_surface text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(trim(p_email));
  fail_count int;
  lock_until timestamptz;
  retry int;
BEGIN
  IF p_surface IS NULL OR p_surface NOT IN ('staff', 'patient') THEN
    RAISE EXCEPTION 'invalid surface';
  END IF;
  IF normalized = '' OR length(normalized) > 320 THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', 0);
  END IF;

  SELECT max(e.locked_until) INTO lock_until
  FROM public.auth_login_events e
  WHERE e.email = normalized AND e.locked_until IS NOT NULL AND e.locked_until > now();

  IF lock_until IS NOT NULL THEN
    retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (lock_until - now())))::int);
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', retry);
  END IF;

  SELECT count(*)::int INTO fail_count
  FROM public.auth_login_events e
  WHERE e.email = normalized
    AND e.success = false
    AND e.created_at > now() - interval '15 minutes';

  IF fail_count >= 5 THEN
    lock_until := now() + interval '15 minutes';
    INSERT INTO public.auth_login_events (email, surface, success, locked_until)
    VALUES (normalized, p_surface, false, lock_until);
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', 15 * 60);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_event(p_email text, p_surface text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(trim(p_email));
BEGIN
  IF p_surface IS NULL OR p_surface NOT IN ('staff', 'patient') THEN
    RAISE EXCEPTION 'invalid surface';
  END IF;
  IF normalized = '' OR length(normalized) > 320 THEN
    RETURN;
  END IF;

  INSERT INTO public.auth_login_events (email, surface, success)
  VALUES (normalized, p_surface, coalesce(p_success, false));

  IF p_success THEN
    DELETE FROM public.auth_login_events
    WHERE email = normalized AND success = false AND created_at > now() - interval '1 hour';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_throttle(text, text) FROM public;
REVOKE ALL ON FUNCTION public.record_login_event(text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.check_login_throttle(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_event(text, text, boolean) TO anon, authenticated;
