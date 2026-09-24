-- Patient confirmation of an appointment.
--
-- The portal home card should only present an appointment as "your next
-- appointment" once the patient has confirmed it; until then it asks them to.
-- There is no "confirmed" appointment_status (the enum is booked | attended |
-- cancelled | no_show and the visit stage is separate), so confirmation is a
-- timestamp on the row rather than a status change — staff scheduling is
-- unaffected and the clinic can still see who has and has not confirmed.
--
-- Patients can only SELECT their own appointments. Rather than opening UPDATE
-- on the row (which would let a patient touch price, status or time), the
-- write goes through a SECURITY DEFINER function that sets this one column on
-- the caller's own, still-booked, future appointment.

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN patient_confirmed_at timestamptz;

COMMENT ON COLUMN public.appointments.patient_confirmed_at IS
  'When the patient confirmed the booking from the portal. NULL until they do.';

-- ---------------------------------------------------------------------------
-- 2. Confirm function — the only write path for the column from the portal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_appointment(p_appointment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  confirmed timestamptz;
BEGIN
  UPDATE public.appointments
     SET patient_confirmed_at = COALESCE(patient_confirmed_at, now())
   WHERE id = p_appointment_id
     AND patient_id = public.current_patient_id()
     AND status = 'booked'
     AND starts_at > now()
  RETURNING patient_confirmed_at INTO confirmed;

  IF confirmed IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or can no longer be confirmed'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN confirmed;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_appointment(uuid) TO authenticated;
