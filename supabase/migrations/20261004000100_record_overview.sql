-- Patient record redesign: an Overview tab, flagged recovery check-ins that
-- stay open until a clinician reviews them, and who ticked each plan
-- checklist item (the patient in the portal, or the clinic on the record).

-- 1. Check-ins carry a review stamp. "Urgent" = any reading moderate or worse
--    with no reviewed_at; the From the patient tab and the Overview hero read it.
ALTER TABLE public.recovery_checkins
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.recovery_checkins.reviewed_at IS
  'Set when a clinician marks a flagged check-in reviewed on the patient record.';

-- Staff could only read check-ins; marking one reviewed needs an update.
CREATE POLICY "staff review recovery checkins"
  ON public.recovery_checkins
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 2. Checklist attribution: "patient · 28 Sep" on the step details panel.
ALTER TABLE public.plan_milestone_checklist
  ADD COLUMN IF NOT EXISTS done_by_kind text
    CHECK (done_by_kind IS NULL OR done_by_kind IN ('patient', 'clinic')),
  ADD COLUMN IF NOT EXISTS done_by uuid;

COMMENT ON COLUMN public.plan_milestone_checklist.done_by_kind IS
  'Who ticked the item: the patient (portal) or the clinic (record). Null while open.';

-- 3. The Overview tab is visible to every staff role by default; owners hold
--    every key in code. Clinics that already tuned the grid are left alone.
INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::public.app_role, r.permission, true
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager', 'view.patients.overview'),
    ('practitioner', 'view.patients.overview'),
    ('front_desk', 'view.patients.overview')
) AS r(role, permission)
ON CONFLICT (clinic_id, role, permission) DO NOTHING;
