-- Columns the treatment workflow needs on existing tables.
--
-- 1. Aftercare is read out per treatment type, so the catalogue carries the
--    points. Empty means "use the category defaults" in the app.
-- 2. A treatment recorded through the form is tied to the appointment it was
--    delivered in; the record page, the plan milestone and the portal
--    timeline all read that link.
-- 3. Photos taken during the visit are captured before the treatments row
--    exists, so they hang off the appointment and are re-pointed on
--    completion.
-- 4. Consent completed in clinic is signed by the patient on the clinic's
--    device; the staff member who witnessed it is recorded.

ALTER TABLE public.treatment_catalogue
  ADD COLUMN aftercare_points text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.treatment_catalogue.aftercare_points IS
  'Aftercare read out to the patient after this treatment. Empty falls back to the category defaults.';

ALTER TABLE public.treatments
  ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX treatments_appointment_idx
  ON public.treatments (clinic_id, appointment_id);

ALTER TABLE public.treatment_photos
  ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX treatment_photos_appointment_idx
  ON public.treatment_photos (clinic_id, appointment_id);

ALTER TABLE public.documents
  ADD COLUMN witnessed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.witnessed_by IS
  'Staff member present when the patient signed on the clinic''s device. NULL for signatures made remotely.';
