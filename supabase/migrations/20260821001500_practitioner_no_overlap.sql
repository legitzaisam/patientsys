-- Prevent the same practitioner from holding two non-cancelled bookings that overlap in time.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_practitioner_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_practitioner_overlap
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (practitioner_id IS NOT NULL AND status IS DISTINCT FROM 'cancelled');
