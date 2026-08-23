-- Phase 3: six new capability keys covering the clinical surface.
--
-- Until now these handlers had no capability at all — savePatient, addTreatment,
-- saveAppointment, sendDocument, reviewHistory and saveAppointmentNote reached
-- the database with no authorization check whatsoever, so any signed-in patient
-- could rewrite another patient's allergies or stamp a medical history as
-- clinically reviewed.
--
-- Every staff role is seeded enabled so nobody loses an ability they exercise
-- today; the point of the phase is that the owner can now switch them off.
-- Recommended tightening once the clinic has agreed it: front desk should not
-- hold treatments.record, which grants clinical note and treatment writes.
--
-- Owners are deliberately absent: can() grants them every key implicitly, so a
-- row here would be a second source of truth that could disagree.

INSERT INTO public.role_permissions (role, permission, enabled)
SELECT r.role::app_role, p.permission, true
FROM (VALUES ('manager'), ('practitioner'), ('front_desk')) AS r(role)
CROSS JOIN (
  VALUES
    ('patients.edit'),
    ('treatments.record'),
    ('documents.send'),
    ('photos.manage'),
    ('appointments.edit'),
    ('comms.send')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;
