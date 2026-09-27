-- Deposit rules live in Settings (Payments and deposits) instead of being
-- written into the dashboard copy. The dashboard's "deposit due" urgency and
-- the money model read them from here.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS deposit_lead_days integer NOT NULL DEFAULT 3
    CHECK (deposit_lead_days >= 0 AND deposit_lead_days <= 30),
  ADD COLUMN IF NOT EXISTS deposit_percent integer NOT NULL DEFAULT 30
    CHECK (deposit_percent >= 0 AND deposit_percent <= 100);

COMMENT ON COLUMN public.clinics.deposit_lead_days IS
  'Days before an appointment by which the deposit must be paid; drives the dashboard urgency.';
COMMENT ON COLUMN public.clinics.deposit_percent IS
  'Deposit as a percentage of the treatment price; a deposit_paid booking counts this share as collected.';
