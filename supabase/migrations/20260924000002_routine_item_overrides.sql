-- A patient's own product for a routine step.
--
-- The clinic sets the routine (skincare_routines / routine_items). Patients
-- often use something else for a step — a different cleanser, the SPF they
-- already own — and the routine page should say what they actually use
-- beside what the clinic recommended, without letting them edit the clinic's
-- rows. So the patient's choice is a separate override, one per routine item,
-- that the patient owns outright and staff can read.
--
-- `product_url` is what the patient pasted; `source` records how the name and
-- instructions were filled in: from the page's metadata, by the AI helper
-- reading the page, or typed by hand.

CREATE TABLE public.routine_item_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  routine_item_id uuid NOT NULL REFERENCES public.routine_items(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  how_to text,
  product_url text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('link', 'ai', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_item_id)
);

COMMENT ON TABLE public.routine_item_overrides IS
  'The product a patient actually uses for a routine step, kept beside the clinic''s recommendation.';

CREATE INDEX routine_item_overrides_patient_idx
  ON public.routine_item_overrides (clinic_id, patient_id);

CREATE TRIGGER routine_item_overrides_updated
  BEFORE UPDATE ON public.routine_item_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.routine_item_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.routine_item_overrides FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.routine_item_overrides TO authenticated;

CREATE POLICY "staff read routine overrides"
  ON public.routine_item_overrides
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "patients manage own routine overrides"
  ON public.routine_item_overrides
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.routine_item_overrides
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
