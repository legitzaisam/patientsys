-- Former team members: keep a staff identity snapshot for 90 days after revoke.
-- Clinical/patient rows are never stored here and must never be deleted by purge.

CREATE TABLE IF NOT EXISTS public.ex_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  full_name text NOT NULL DEFAULT '',
  job_title text,
  registration_body text,
  registration_number text,
  role text NOT NULL,
  commission_rate numeric,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  retain_until timestamptz NOT NULL,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One active (not-yet-purged) archive row per user.
CREATE UNIQUE INDEX IF NOT EXISTS ex_team_members_active_user_uidx
  ON public.ex_team_members (user_id)
  WHERE purged_at IS NULL;

CREATE INDEX IF NOT EXISTS ex_team_members_retain_until_idx
  ON public.ex_team_members (retain_until)
  WHERE purged_at IS NULL;

GRANT SELECT ON public.ex_team_members TO authenticated;
GRANT ALL ON public.ex_team_members TO service_role;
ALTER TABLE public.ex_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read ex team" ON public.ex_team_members;
CREATE POLICY "staff read ex team" ON public.ex_team_members
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON TABLE public.ex_team_members IS
  'Staff identity retained for 90 days after access revoke. Purge clears this row and staff-only files — never patient or clinical records.';
