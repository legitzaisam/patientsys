CREATE TABLE public.treatment_colours (
  treatment_name text PRIMARY KEY,
  lane smallint NOT NULL CHECK (lane BETWEEN 1 AND 8),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_colours TO authenticated;
GRANT ALL ON public.treatment_colours TO service_role;
ALTER TABLE public.treatment_colours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read treatment colours" ON public.treatment_colours FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'practitioner') OR public.has_role(auth.uid(),'front_desk'));
CREATE POLICY "owners manage treatment colours" ON public.treatment_colours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));