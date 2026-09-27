-- Quick book captures the minimum (who, what, when). The flag marks those
-- bookings so reception finishes them; a full edit clears it.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS details_incomplete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.details_incomplete IS
  'Set by Quick book; cleared when the booking is edited through the full dialog.';
