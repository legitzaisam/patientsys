CREATE TABLE public.treatment_colour_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  colours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX treatment_colour_themes_name_key ON public.treatment_colour_themes (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_colour_themes TO authenticated;
GRANT ALL ON public.treatment_colour_themes TO service_role;

ALTER TABLE public.treatment_colour_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read colour themes" ON public.treatment_colour_themes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'practitioner') OR public.has_role(auth.uid(),'front_desk'));
CREATE POLICY "owners manage colour themes" ON public.treatment_colour_themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_treatment_colour_themes_updated_at
  BEFORE UPDATE ON public.treatment_colour_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();