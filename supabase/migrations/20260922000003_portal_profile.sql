-- Patient portal, part 4 of 4 — the profile fields the portal shows.
--
-- The Records page asks for a postal address and an emergency contact, and
-- lets the patient log treatments they had at OTHER clinics so this clinic
-- has the full picture. Those are the columns and the table added here.
--
-- Emergency contact and address live on patients (one-to-one, always shown
-- together) rather than a side table; external history is a list, so it gets
-- its own table. Patients own their external history outright; the address
-- and emergency contact are updated through a server function that scopes
-- the write to their own row.

-- ---------------------------------------------------------------------------
-- 1. Patient columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN address_line1 text,
  ADD COLUMN address_line2 text,
  ADD COLUMN city text,
  ADD COLUMN postcode text,
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_relationship text,
  ADD COLUMN emergency_contact_phone text;

COMMENT ON COLUMN public.patients.emergency_contact_name IS
  'Next of kin shown on the portal Records page and used if a treatment goes wrong.';

-- ---------------------------------------------------------------------------
-- 2. Treatments elsewhere
-- ---------------------------------------------------------------------------
CREATE TABLE public.external_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment text NOT NULL,
  clinic_name text NOT NULL,
  -- Patients rarely remember the exact day, so this is free text ("Jan 2024").
  performed_label text NOT NULL,
  performed_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.external_treatments IS
  'Treatments the patient had at other clinics, self-reported through the portal.';

CREATE INDEX external_treatments_patient_idx
  ON public.external_treatments (clinic_id, patient_id, performed_on DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 3. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.external_treatments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.external_treatments FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.external_treatments TO authenticated;

CREATE POLICY "staff read external treatments"
  ON public.external_treatments
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "patients manage own external treatments"
  ON public.external_treatments
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.external_treatments
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
