CREATE TABLE public.appointment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id),
  body text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_by_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_notes TO authenticated;
GRANT ALL ON public.appointment_notes TO service_role;

ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view visit notes" ON public.appointment_notes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can add visit notes" ON public.appointment_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can edit visit notes" ON public.appointment_notes
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Managers can delete visit notes" ON public.appointment_notes
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER appointment_notes_updated BEFORE UPDATE ON public.appointment_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();