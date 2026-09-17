-- Treatment plans (patient journeys) — the schema behind the journey board,
-- the dashboard "Active skin plans" KPI and the "Active treatment journeys"
-- section.
--
-- A plan is a named, phased course of care for one patient (e.g. "3-Month
-- Microneedling Plan"): a practitioner owns it, it advances through four
-- phases, and its milestones are the ordered steps (sessions, tasks and
-- conditional steps) that the clinic tracks. Milestones may point at the
-- diary appointment that fulfils them.
--
-- Grants follow Phase 5.1: authenticated keeps RLS-governed DML, anon gets
-- SELECT that every policy refuses. Staff-only permissive policies plus the
-- Phase 5 RESTRICTIVE clinic_isolation shape. Patients may read their own
-- plans (future patient portal); they can never write.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.treatment_plan_phase AS ENUM (
  'consult',
  'foundation',
  'build',
  'results'
);

CREATE TYPE public.treatment_plan_status AS ENUM (
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE public.plan_milestone_kind AS ENUM (
  'session',
  'task',
  'conditional'
);

CREATE TYPE public.plan_milestone_status AS ENUM (
  'upcoming',
  'current',
  'done',
  'skipped'
);

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  catalogue_id uuid REFERENCES public.treatment_catalogue(id) ON DELETE SET NULL,
  name text NOT NULL,
  phase public.treatment_plan_phase NOT NULL DEFAULT 'consult',
  status public.treatment_plan_status NOT NULL DEFAULT 'active',
  total_sessions integer NOT NULL DEFAULT 1 CHECK (total_sessions > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.treatment_plans IS
  'Phased course of care for one patient (a "journey"). Milestones carry the ordered steps; phase drives the journey board column.';

CREATE INDEX treatment_plans_board_idx
  ON public.treatment_plans (clinic_id, status, phase);

CREATE INDEX treatment_plans_patient_idx
  ON public.treatment_plans (clinic_id, patient_id, status);

CREATE INDEX treatment_plans_practitioner_idx
  ON public.treatment_plans (clinic_id, practitioner_id, status);

CREATE TABLE public.plan_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  idx integer NOT NULL CHECK (idx >= 1),
  title text NOT NULL,
  kind public.plan_milestone_kind NOT NULL DEFAULT 'task',
  status public.plan_milestone_status NOT NULL DEFAULT 'upcoming',
  due_date date,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, idx)
);

COMMENT ON TABLE public.plan_milestones IS
  'Ordered steps of a treatment plan: sessions, tasks and conditional steps. May reference the diary appointment that fulfils them.';

CREATE INDEX plan_milestones_plan_idx
  ON public.plan_milestones (clinic_id, plan_id, idx);

CREATE INDEX plan_milestones_due_idx
  ON public.plan_milestones (clinic_id, status, due_date);

-- ---------------------------------------------------------------------------
-- 3. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_milestones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.treatment_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.plan_milestones FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.treatment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plan_milestones TO authenticated;

CREATE POLICY "staff manage treatment plans"
  ON public.treatment_plans
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own treatment plans"
  ON public.treatment_plans
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.treatment_plans
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage plan milestones"
  ON public.plan_milestones
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own plan milestones"
  ON public.plan_milestones
  FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT tp.id
      FROM public.treatment_plans tp
      JOIN public.patients p ON p.id = tp.patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.plan_milestones
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
