-- Two new capabilities and a review of the seeded defaults.
--
--   reports.commission     clinic earnings, commission rates and payouts on
--                          Performance. Off for every role until the owner
--                          grants it (the owner always holds it).
--   patients.edit_clinical allergies, medication, conditions and medical
--                          history on a patient record. Managers and
--                          practitioners on, receptionists off.
--
-- Defaults review (only rows nobody has changed by hand): receptionists lose
-- Insights, Treatments & colours and the Medical history / From the patient
-- tabs; practitioners gain Insights; managers gain Design and automate offers.

INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::public.app_role, r.permission, r.enabled
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager',      'reports.commission',     false),
    ('practitioner', 'reports.commission',     false),
    ('front_desk',   'reports.commission',     false),
    ('manager',      'patients.edit_clinical', true),
    ('practitioner', 'patients.edit_clinical', true),
    ('front_desk',   'patients.edit_clinical', false)
) AS r(role, permission, enabled)
ON CONFLICT DO NOTHING;

UPDATE public.role_permissions SET enabled = true
  WHERE updated_by IS NULL AND role = 'practitioner' AND permission IN ('reports.insights', 'view.insights.pipeline', 'view.insights.book');
UPDATE public.role_permissions SET enabled = true
  WHERE updated_by IS NULL AND role = 'manager' AND permission = 'offers.manage';
UPDATE public.role_permissions SET enabled = false
  WHERE updated_by IS NULL AND role = 'front_desk'
    AND permission IN ('reports.insights', 'view.insights.pipeline', 'view.insights.book', 'settings.treatments', 'view.patients.history', 'view.patients.from_patient');
