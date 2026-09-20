-- Insights: clinic-wide marketing and sales.
--
-- Adds an attribution source on patients, website-lead and retail-sale
-- ingest tables, a hashed clinic ingest key, and the reports.insights
-- capability (manager and front desk on, practitioner off). Owners stay
-- implicit via can().

-- ---------------------------------------------------------------------------
-- 1. Patient source + clinic ingest key
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_source_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_source_check
  CHECK (source IS NULL OR source IN ('website', 'instagram', 'referral', 'walk_in', 'other'));

COMMENT ON COLUMN public.patients.source IS
  'How the patient found the clinic: website, instagram, referral, walk_in or other.';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS insights_ingest_key_hash text;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS insights_ingest_key_last4 text;

COMMENT ON COLUMN public.clinics.insights_ingest_key_hash IS
  'SHA-256 hex of the Bearer token a website provider sends to POST /api/insights/events.';

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.website_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  external_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'website'
    CHECK (source IN ('website', 'instagram', 'referral', 'walk_in', 'other')),
  campaign text,
  interest text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, external_id)
);

COMMENT ON TABLE public.website_leads IS
  'Website-provider sign-ups and enquiries. Matched to a patient when the email agrees.';

CREATE INDEX website_leads_clinic_occurred_idx
  ON public.website_leads (clinic_id, occurred_at DESC);

CREATE INDEX website_leads_clinic_email_idx
  ON public.website_leads (clinic_id, lower(email));

CREATE TABLE public.retail_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric,
  active boolean NOT NULL DEFAULT true,
  featured_on_portal boolean NOT NULL DEFAULT false,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.retail_products IS
  'Physical products the clinic lists. Featured rows appear on the patient portal; no cart.';

CREATE UNIQUE INDEX retail_products_clinic_sku_idx
  ON public.retail_products (clinic_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX retail_products_clinic_active_idx
  ON public.retail_products (clinic_id, active, featured_on_portal);

CREATE TABLE public.product_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.retail_products(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  external_id text,
  source text NOT NULL DEFAULT 'website'
    CHECK (source IN ('website', 'instagram', 'referral', 'walk_in', 'other')),
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  amount numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, external_id)
);

COMMENT ON TABLE public.product_sales IS
  'Retail units sold, usually ingested from a website provider. Optional patient match.';

CREATE INDEX product_sales_clinic_occurred_idx
  ON public.product_sales (clinic_id, occurred_at DESC);

CREATE INDEX product_sales_clinic_product_idx
  ON public.product_sales (clinic_id, product_id);

-- ---------------------------------------------------------------------------
-- 3. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.website_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.website_leads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.retail_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_sales FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.website_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retail_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sales TO authenticated;

CREATE POLICY "staff manage website leads"
  ON public.website_leads
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY clinic_isolation
  ON public.website_leads
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage retail products"
  ON public.retail_products
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read featured retail products"
  ON public.retail_products
  FOR SELECT
  TO authenticated
  USING (
    featured_on_portal
    AND active
    AND clinic_id = public.current_clinic_id()
  );

CREATE POLICY clinic_isolation
  ON public.retail_products
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage product sales"
  ON public.product_sales
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "patients read own product sales"
  ON public.product_sales
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.product_sales
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------------------
-- 4. Capability defaults
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::app_role, 'reports.insights', r.enabled
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager', true),
    ('front_desk', true),
    ('practitioner', false)
) AS r(role, enabled)
ON CONFLICT (clinic_id, role, permission) DO NOTHING;
