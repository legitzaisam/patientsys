CREATE TYPE public.appointment_status AS ENUM ('booked','attended','cancelled','no_show');
CREATE TYPE public.payment_status AS ENUM ('unpaid','deposit_paid','paid','refunded');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES public.profiles(id),
  catalogue_id uuid REFERENCES public.treatment_catalogue(id),
  treatment_name text NOT NULL,
  treatment_number integer NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'booked',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  price numeric,
  consent_document_id uuid REFERENCES public.documents(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointments_starts_at_idx ON public.appointments (starts_at);
CREATE INDEX appointments_practitioner_idx ON public.appointments (practitioner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patient reads own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

CREATE TRIGGER appointments_updated
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();