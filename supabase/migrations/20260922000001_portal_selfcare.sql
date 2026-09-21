-- Patient portal, part 2 of 4 — what the patient records themselves.
--
-- Three things the portal lets a patient write, and the clinic read:
--   journal_entries      diary of products, photos, symptoms and voice notes
--   recovery_checkins    how the skin feels today (redness/sensitivity/dryness)
--   routine_completions  one row per routine period completed, which the
--                        portal's adherence percentage is derived from
--
-- Adherence is deliberately NOT a stored number: storing a percentage would
-- drift from the rows behind it. The portal counts completions over the last
-- seven days instead.
--
-- These are the only patient-writable clinical tables, so their policies are
-- tighter than elsewhere: a patient may insert and manage their own rows and
-- read nothing else; staff read and manage everything in their clinic.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.journal_entry_kind AS ENUM (
  'skincare',
  'photos',
  'vitamins',
  'appointment',
  'skin_change',
  'voice_note'
);

CREATE TYPE public.journal_attachment_kind AS ENUM (
  'photo',
  'voice'
);

CREATE TYPE public.routine_period AS ENUM (
  'morning',
  'evening'
);

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  kind public.journal_entry_kind NOT NULL DEFAULT 'skincare',
  title text NOT NULL,
  body text,
  entry_date date NOT NULL DEFAULT current_date,
  -- Patients may keep an entry private; the clinic only sees shared ones.
  shared_with_clinic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journal_entries IS
  'Patient-authored journal shown on the portal Journal tab and the staff record page.';

CREATE INDEX journal_entries_patient_idx
  ON public.journal_entries (clinic_id, patient_id, entry_date DESC);

CREATE TABLE public.journal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  kind public.journal_attachment_kind NOT NULL DEFAULT 'photo',
  storage_path text NOT NULL,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journal_attachments IS
  'Photos and voice notes attached to a journal entry.';

CREATE INDEX journal_attachments_entry_idx
  ON public.journal_attachments (clinic_id, entry_id);

CREATE TABLE public.recovery_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT current_date,
  -- 0-100 sliders; the portal maps them to Mild / Moderate / Severe.
  redness smallint NOT NULL CHECK (redness BETWEEN 0 AND 100),
  sensitivity smallint NOT NULL CHECK (sensitivity BETWEEN 0 AND 100),
  dryness smallint NOT NULL CHECK (dryness BETWEEN 0 AND 100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, checkin_date)
);

COMMENT ON TABLE public.recovery_checkins IS
  'Daily self-reported recovery readings. One row per patient per day; re-submitting updates it.';

CREATE INDEX recovery_checkins_patient_idx
  ON public.recovery_checkins (clinic_id, patient_id, checkin_date DESC);

CREATE TABLE public.routine_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  period public.routine_period NOT NULL,
  completed_on date NOT NULL DEFAULT current_date,
  -- Set when the patient snoozes rather than completes; the reminder card
  -- reads the latest value to show "snoozed until".
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, period, completed_on)
);

COMMENT ON TABLE public.routine_completions IS
  'One row per routine period the patient completed. Adherence is counted from these rows, never stored.';

CREATE INDEX routine_completions_patient_idx
  ON public.routine_completions (clinic_id, patient_id, completed_on DESC);

-- ---------------------------------------------------------------------------
-- 3. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.journal_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.journal_attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.recovery_checkins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.routine_completions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recovery_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.routine_completions TO authenticated;

-- Journal: staff read shared entries, patients own theirs outright.
CREATE POLICY "staff read shared journal entries"
  ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND shared_with_clinic = true);

CREATE POLICY "patients manage own journal entries"
  ON public.journal_entries
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.journal_entries
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff read shared journal attachments"
  ON public.journal_attachments
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND entry_id IN (SELECT id FROM public.journal_entries WHERE shared_with_clinic = true)
  );

CREATE POLICY "patients manage own journal attachments"
  ON public.journal_attachments
  FOR ALL
  TO authenticated
  USING (
    entry_id IN (
      SELECT je.id
      FROM public.journal_entries je
      JOIN public.patients p ON p.id = je.patient_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT je.id
      FROM public.journal_entries je
      JOIN public.patients p ON p.id = je.patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.journal_attachments
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- Check-ins and routine completions: clinical signal, so staff read all.
CREATE POLICY "staff read recovery checkins"
  ON public.recovery_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "patients manage own recovery checkins"
  ON public.recovery_checkins
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.recovery_checkins
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff read routine completions"
  ON public.routine_completions
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "patients manage own routine completions"
  ON public.routine_completions
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.routine_completions
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
