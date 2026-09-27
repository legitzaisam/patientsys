-- Registration and insurance expiry, insurer and qualifications on staff
-- profiles, so the Team page can show compliance and the owner can be
-- reminded before something lapses.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_expiry date,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS qualifications text;

COMMENT ON COLUMN public.profiles.registration_expiry IS 'When the professional registration lapses.';
COMMENT ON COLUMN public.profiles.insurance_provider IS 'Medical indemnity insurer.';
COMMENT ON COLUMN public.profiles.insurance_expiry IS 'When the indemnity cover lapses.';
COMMENT ON COLUMN public.profiles.qualifications IS 'Free text: qualifications the clinic wants on record.';
