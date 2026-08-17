CREATE TABLE public.retention_outreach (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  contacted_by uuid,
  channel text NOT NULL DEFAULT 'message',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX retention_outreach_patient_idx ON public.retention_outreach (patient_id, created_at DESC);

GRANT SELECT, INSERT ON public.retention_outreach TO authenticated;
GRANT ALL ON public.retention_outreach TO service_role;

ALTER TABLE public.retention_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view retention outreach"
  ON public.retention_outreach FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can log retention outreach"
  ON public.retention_outreach FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND contacted_by = auth.uid());