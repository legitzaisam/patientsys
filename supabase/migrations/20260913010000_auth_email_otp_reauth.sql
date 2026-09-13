-- The hosted Auth "magic link" template cannot be edited on the free tier, so
-- login codes go out as the reauthentication email (which already includes
-- {{ .Token }}). This checks the code against auth.users the same way GoTrue
-- does: SHA-224 of email || otp.

CREATE OR REPLACE FUNCTION public.match_reauthentication_otp(p_user_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, extensions
AS $$
DECLARE
  stored text;
  sent_at timestamptz;
  email text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN
    RETURN false;
  END IF;

  SELECT u.email, u.reauthentication_token, u.reauthentication_sent_at
    INTO email, stored, sent_at
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF email IS NULL OR stored IS NULL OR sent_at IS NULL THEN
    RETURN false;
  END IF;
  IF sent_at < now() - interval '10 minutes' THEN
    RETURN false;
  END IF;

  RETURN stored = encode(extensions.digest(convert_to(email || p_code, 'UTF8'), 'sha224'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.match_reauthentication_otp(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_reauthentication_otp(uuid, text) TO service_role;
