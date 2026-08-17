CREATE TYPE public.recall_task_status AS ENUM ('sent', 'contacted', 'completed');

CREATE TABLE public.recall_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_to uuid,
  assigned_label text,
  created_by uuid,
  note text,
  status public.recall_task_status NOT NULL DEFAULT 'sent',
  contacted_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.recall_tasks TO authenticated;
GRANT ALL ON public.recall_tasks TO service_role;

ALTER TABLE public.recall_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view recall tasks"
  ON public.recall_tasks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create recall tasks"
  ON public.recall_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update recall tasks"
  ON public.recall_tasks FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER recall_tasks_updated
  BEFORE UPDATE ON public.recall_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX recall_tasks_patient_idx ON public.recall_tasks (patient_id, created_at DESC);