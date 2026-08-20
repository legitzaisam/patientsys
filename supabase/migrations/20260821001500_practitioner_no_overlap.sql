-- Prevent the same practitioner from holding two non-cancelled bookings that overlap in time.
-- Uses btree_gist so equality on uuid can combine with range overlap in one EXCLUDE constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_practitioner_overlap;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.appointments b
      ON a.practitioner_id = b.practitioner_id
     AND a.id < b.id
     AND a.practitioner_id IS NOT NULL
     AND a.status IS DISTINCT FROM 'cancelled'
     AND b.status IS DISTINCT FROM 'cancelled'
     AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
  ) THEN
    RAISE NOTICE
      'Skipping appointments_no_practitioner_overlap: resolve existing overlapping bookings first, then re-run this migration.';
  ELSE
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_practitioner_overlap
      EXCLUDE USING gist (
        practitioner_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (practitioner_id IS NOT NULL AND status IS DISTINCT FROM 'cancelled');
  END IF;
END $$;
