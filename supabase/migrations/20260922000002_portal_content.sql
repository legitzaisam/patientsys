-- Patient portal, part 3 of 4 — content the clinic authors for patients.
--
--   skincare_routines / routine_items   the AM and PM routine a practitioner
--                                       prescribes, with per-product how-to
--   clinic_news                         the news card on the portal home
--   clinic_offers                       the promotional card beside it
--
-- All three are clinic-owned and patient-read-only. News and offers are
-- clinic-wide (no patient_id); routines belong to one patient.
--
-- Publishing is explicit: news and offers only reach the portal when
-- published_at is set and any expires_at has not passed, so drafts can sit in
-- the table safely.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.skincare_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  headline text,
  body text,
  practitioner_note text,
  note_dated_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

COMMENT ON TABLE public.skincare_routines IS
  'The routine a practitioner prescribes for one patient; items carry the products.';

CREATE INDEX skincare_routines_patient_idx
  ON public.skincare_routines (clinic_id, patient_id);

CREATE TABLE public.routine_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.skincare_routines(id) ON DELETE CASCADE,
  period public.routine_period NOT NULL,
  step text NOT NULL,
  product_name text NOT NULL,
  how_to text,
  position integer NOT NULL DEFAULT 0,
  optional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.routine_items IS
  'One product step in a morning or evening routine, in display order.';

CREATE INDEX routine_items_routine_idx
  ON public.routine_items (clinic_id, routine_id, period, position);

CREATE TABLE public.clinic_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text,
  image_path text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_news IS
  'Clinic announcements shown on the portal home. Only rows with published_at reach patients.';

CREATE INDEX clinic_news_published_idx
  ON public.clinic_news (clinic_id, published_at DESC);

CREATE TABLE public.clinic_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  flag text,
  title text NOT NULL,
  body text,
  cta_label text,
  cta_url text,
  image_path text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_offers IS
  'Promotional cards on the portal home. Published and unexpired rows only.';

CREATE INDEX clinic_offers_live_idx
  ON public.clinic_offers (clinic_id, published_at DESC, expires_at);

-- ---------------------------------------------------------------------------
-- 2. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.skincare_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_offers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.skincare_routines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.routine_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_news FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_offers FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skincare_routines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.routine_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_news TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_offers TO authenticated;

CREATE POLICY "staff manage skincare routines"
  ON public.skincare_routines
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own skincare routine"
  ON public.skincare_routines
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY clinic_isolation
  ON public.skincare_routines
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage routine items"
  ON public.routine_items
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own routine items"
  ON public.routine_items
  FOR SELECT
  TO authenticated
  USING (
    routine_id IN (
      SELECT sr.id
      FROM public.skincare_routines sr
      JOIN public.patients p ON p.id = sr.patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.routine_items
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage clinic news"
  ON public.clinic_news
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read published clinic news"
  ON public.clinic_news
  FOR SELECT
  TO authenticated
  USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY clinic_isolation
  ON public.clinic_news
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage clinic offers"
  ON public.clinic_offers
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read live clinic offers"
  ON public.clinic_offers
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY clinic_isolation
  ON public.clinic_offers
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
