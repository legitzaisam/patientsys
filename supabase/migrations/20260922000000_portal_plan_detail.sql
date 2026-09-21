-- Patient portal, part 1 of 4 — plan and milestone detail.
--
-- The staff journey board only needs a milestone's title, date and status.
-- The patient portal's Timeline shows the same milestones as a guided
-- roadmap: grouped into months, each step carrying an explanation, a
-- patient-facing checklist and clinician guidance. Those are the columns and
-- the child table added here.
--
-- Patients may also ask the clinic to pause a plan. A pause is a *request*,
-- never an immediate state change — the clinic decides — so it lives in its
-- own table and only flips treatment_plans.status once approved.
--
-- Grants follow Phase 5.1: authenticated keeps RLS-governed DML, staff-only
-- permissive policies plus the RESTRICTIVE clinic_isolation shape. Patients
-- read their own plan detail, write only pause requests and their own
-- checklist ticks.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
ALTER TYPE public.treatment_plan_status ADD VALUE IF NOT EXISTS 'paused';

CREATE TYPE public.plan_pause_status AS ENUM (
  'pending',
  'approved',
  'declined'
);

-- ---------------------------------------------------------------------------
-- 2. Plan and milestone detail columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.treatment_plans
  ADD COLUMN strapline text,
  ADD COLUMN duration_days integer CHECK (duration_days IS NULL OR duration_days > 0);

COMMENT ON COLUMN public.treatment_plans.strapline IS
  'One-line promise shown under the plan name in the patient portal.';
COMMENT ON COLUMN public.treatment_plans.duration_days IS
  'Planned length; drives the portal "Day X of Y" counter.';

ALTER TABLE public.plan_milestones
  ADD COLUMN detail text,
  ADD COLUMN guidance text,
  ADD COLUMN month_group integer CHECK (month_group IS NULL OR month_group > 0),
  ADD COLUMN month_title text,
  ADD COLUMN month_blurb text,
  ADD COLUMN icon text;

COMMENT ON COLUMN public.plan_milestones.detail IS
  'Plain-language explanation of the step for the patient timeline.';
COMMENT ON COLUMN public.plan_milestones.guidance IS
  'Clinician guidance shown in the portal step-details panel.';
COMMENT ON COLUMN public.plan_milestones.month_group IS
  'Roadmap grouping (1 = first month). Milestones sharing a group render under one heading.';
COMMENT ON COLUMN public.plan_milestones.icon IS
  'Icon key for the portal step row (drop, cal, shield, msg, photo, layers, heart, plus).';

-- ---------------------------------------------------------------------------
-- 3. Milestone checklist
-- ---------------------------------------------------------------------------
CREATE TABLE public.plan_milestone_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.plan_milestones(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  -- Clinic-owned items (e.g. "Results reviewed by clinic") render locked in
  -- the portal; the patient can never tick them.
  clinic_owned boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_milestone_checklist IS
  'Per-milestone checklist shown in the patient portal step-details panel.';

CREATE INDEX plan_milestone_checklist_milestone_idx
  ON public.plan_milestone_checklist (clinic_id, milestone_id, position);

-- ---------------------------------------------------------------------------
-- 4. Pause requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.plan_pause_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  reason text NOT NULL,
  notes text,
  status public.plan_pause_status NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_pause_requests IS
  'Patient-submitted request to pause a plan. The clinic approves or declines; only approval pauses the plan.';

CREATE INDEX plan_pause_requests_open_idx
  ON public.plan_pause_requests (clinic_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_milestone_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_pause_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.plan_milestone_checklist FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.plan_pause_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_milestone_checklist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_pause_requests TO authenticated;

CREATE POLICY "staff manage milestone checklist"
  ON public.plan_milestone_checklist
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own milestone checklist"
  ON public.plan_milestone_checklist
  FOR SELECT
  TO authenticated
  USING (
    milestone_id IN (
      SELECT pm.id
      FROM public.plan_milestones pm
      JOIN public.treatment_plans tp ON tp.id = pm.plan_id
      JOIN public.patients p ON p.id = tp.patient_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Patients tick their own items only; clinic-owned rows stay locked.
CREATE POLICY "patients tick own checklist items"
  ON public.plan_milestone_checklist
  FOR UPDATE
  TO authenticated
  USING (
    clinic_owned = false
    AND milestone_id IN (
      SELECT pm.id
      FROM public.plan_milestones pm
      JOIN public.treatment_plans tp ON tp.id = pm.plan_id
      JOIN public.patients p ON p.id = tp.patient_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (clinic_owned = false);

CREATE POLICY clinic_isolation
  ON public.plan_milestone_checklist
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage pause requests"
  ON public.plan_pause_requests
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own pause requests"
  ON public.plan_pause_requests
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "patients raise own pause requests"
  ON public.plan_pause_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.plan_pause_requests
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
