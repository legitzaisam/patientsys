ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read templates" ON public.message_templates FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add templates" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit templates" ON public.message_templates FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete templates" ON public.message_templates FOR DELETE TO authenticated USING (is_owner(auth.uid()));

CREATE TRIGGER message_templates_updated BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();