-- The treatment form.
--
-- A practitioner runs a visit through three pages: what to check before
-- starting, what was done, and the aftercare read out to the patient. Each
-- page's button moves the appointment's stage (in_treatment → aftercare →
-- complete) so the rest of the clinic can see where the patient is. The form
-- itself is kept — one row per appointment — so the completed visit can be
-- opened later as a record, and on completion it fans out into the treatment
-- history, the visit note and the photos taken during the visit.
--
-- `status` is the form's own progress, distinct from the appointment stage it
-- drives: a draft is saved before the stage moves, and the two can disagree
-- for a moment between the save and the stage update.

CREATE TABLE public.treatment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  catalogue_id uuid REFERENCES public.treatment_catalogue(id) ON DELETE SET NULL,
  -- Set on completion: the treatments row this visit produced.
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  -- Page 1: the standard pre-treatment checks, as {key: {answer, note}}.
  pre_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Page 2: results as {area, product, dose}; notes as free text.
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  treatment_notes text,
  visit_notes text,
  -- Page 3: the points read out, as [{label, covered}], plus anything extra said.
  aftercare_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  aftercare_extra text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'treating', 'aftercare', 'complete')),
  started_at timestamptz,
  treating_at timestamptz,
  aftercare_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.treatment_sessions IS
  'The three-page treatment form for one appointment; retained as the record of the visit.';
COMMENT ON COLUMN public.treatment_sessions.status IS
  'Form progress: started (page 1 open) → treating (page 2) → aftercare (page 3) → complete.';

CREATE INDEX treatment_sessions_patient_idx
  ON public.treatment_sessions (clinic_id, patient_id, completed_at DESC NULLS LAST);

CREATE TRIGGER treatment_sessions_updated
  BEFORE UPDATE ON public.treatment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.treatment_sessions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.treatment_sessions TO authenticated;

CREATE POLICY "staff manage treatment sessions"
  ON public.treatment_sessions
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Patients may read their own completed visits: the portal timeline shows the
-- visit note and aftercare from the finished form.
CREATE POLICY "patients read own completed sessions"
  ON public.treatment_sessions
  FOR SELECT
  TO authenticated
  USING (
    status = 'complete'
    AND patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.treatment_sessions
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
