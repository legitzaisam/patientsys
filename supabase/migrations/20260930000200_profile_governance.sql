-- Working arrangement on staff profiles, and the extra fields a change
-- request can carry (email, arrangement, registration expiry).
-- requires_owner: a manager who is not the clinic owner must wait for the owner.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS working_arrangement text;

COMMENT ON COLUMN public.profiles.working_arrangement IS
  'How this person works at the clinic — full time, part time, self-employed, and so on.';

ALTER TABLE public.profile_change_requests
  ADD COLUMN IF NOT EXISTS registration_expiry date,
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS working_arrangement text,
  ADD COLUMN IF NOT EXISTS requires_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profile_change_requests.requires_owner IS
  'True when only the clinic owner may approve — used for a manager changing their own details.';
