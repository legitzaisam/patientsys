-- Owner/manager login codes sent by email. Replaces TOTP QR enrolment as the
-- required confirm step. Service-role only; the app never reads this as the user.

CREATE TABLE public.auth_email_otp (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  code_hash text,
  channel text NOT NULL CHECK (channel IN ('hashed', 'supabase_otp')),
  expires_at timestamptz NOT NULL,
  verified_until timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_email_otp ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_email_otp FROM anon, authenticated;
