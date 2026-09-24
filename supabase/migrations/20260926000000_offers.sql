-- Offers and marketing.
--
-- Patients fall into stages (signed up but never consulted; consulted with
-- nothing booked; one treatment with nothing booked; on a skin plan that is
-- nearly finished) and the clinic can put an offer in front of each stage
-- automatically, or send one to a chosen patient or list by hand.
--
-- Two tables: what the clinic designs (offer_templates) and what each patient
-- has been sent (patient_offers). Delivery itself goes through the existing
-- communications outbox with purpose 'marketing', so PECR consent and the
-- unsubscribe footer apply exactly as they do to recalls. The portal card
-- reads patient_offers directly, so a patient without email consent can still
-- see and claim an offer in their portal.

-- ---------------------------------------------------------------------------
-- 1. Templates
-- ---------------------------------------------------------------------------
CREATE TABLE public.offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Which stage this offer is for; 'custom' templates are for one-off sends only.
  stage text NOT NULL DEFAULT 'custom'
    CHECK (stage IN ('pre_consultation', 'post_consultation', 'single_treatment', 'plan_ending', 'custom')),
  subject text NOT NULL,
  headline text NOT NULL,
  body text NOT NULL,
  -- The offer in one line, e.g. "10% off your next session".
  value_text text,
  -- Optional code the patient quotes and front desk applies at booking.
  code text,
  cta_label text NOT NULL DEFAULT 'Claim this offer',
  valid_days integer NOT NULL DEFAULT 30 CHECK (valid_days BETWEEN 1 AND 365),
  send_email boolean NOT NULL DEFAULT true,
  send_sms boolean NOT NULL DEFAULT false,
  show_in_portal boolean NOT NULL DEFAULT true,
  -- Stage automation: off until switched on; the delay is how long a patient
  -- has to have been in the stage before the offer goes.
  automation_enabled boolean NOT NULL DEFAULT false,
  automation_delay_days integer NOT NULL DEFAULT 0 CHECK (automation_delay_days BETWEEN 0 AND 365),
  last_automation_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offer_templates IS
  'Offers the clinic designs: one per stage that can run automatically, plus custom ones for one-off sends.';

-- One live automated template per stage.
CREATE UNIQUE INDEX offer_templates_stage_live_idx
  ON public.offer_templates (clinic_id, stage)
  WHERE stage <> 'custom' AND archived_at IS NULL;

CREATE TRIGGER offer_templates_updated
  BEFORE UPDATE ON public.offer_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. What each patient has been sent
-- ---------------------------------------------------------------------------
CREATE TABLE public.patient_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.offer_templates(id) ON DELETE SET NULL,
  stage text NOT NULL,
  -- Snapshot of the offer as sent, so editing the template later does not
  -- change what the patient was promised.
  headline text NOT NULL,
  body text NOT NULL,
  value_text text,
  code text,
  cta_label text NOT NULL DEFAULT 'Claim this offer',
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'viewed', 'claimed', 'expired', 'cancelled')),
  source text NOT NULL DEFAULT 'one_off'
    CHECK (source IN ('automation', 'one_off', 'bulk', 'insights')),
  -- Where the email went, if one did (NULL when the patient has not consented
  -- to marketing email and the offer is portal-only).
  communication_id uuid REFERENCES public.communications(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.patient_offers IS
  'An offer put in front of one patient: the snapshot they saw, how it went out, and whether they claimed it.';

CREATE INDEX patient_offers_patient_idx
  ON public.patient_offers (clinic_id, patient_id, sent_at DESC);

CREATE INDEX patient_offers_template_idx
  ON public.patient_offers (clinic_id, template_id, sent_at DESC);

-- Automation sends a stage's offer to a patient once.
CREATE UNIQUE INDEX patient_offers_automation_once_idx
  ON public.patient_offers (patient_id, stage)
  WHERE source = 'automation';

-- ---------------------------------------------------------------------------
-- 3. HTML email bodies
-- ---------------------------------------------------------------------------
-- Offers carry a button; the outbox has only ever held plain text. The text
-- body stays the source of truth (and what the comms log shows); the HTML is
-- the presentation sent alongside it when present.
ALTER TABLE public.communications
  ADD COLUMN body_html text;

COMMENT ON COLUMN public.communications.body_html IS
  'Optional HTML rendering sent alongside the plain-text body (offers carry a claim button).';

-- ---------------------------------------------------------------------------
-- 4. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_offers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.offer_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.patient_offers FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_offers TO authenticated;

-- Templates: any staff member can read them (to pick one to send); writes go
-- through server functions that require the offers.manage capability.
CREATE POLICY "staff manage offer templates"
  ON public.offer_templates
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY clinic_isolation
  ON public.offer_templates
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff manage patient offers"
  ON public.patient_offers
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Patients read their own offers and may mark them viewed or claimed.
CREATE POLICY "patients read own offers"
  ON public.patient_offers
  FOR SELECT
  TO authenticated
  USING (patient_id = public.current_patient_id());

CREATE POLICY "patients claim own offers"
  ON public.patient_offers
  FOR UPDATE
  TO authenticated
  USING (patient_id = public.current_patient_id())
  WITH CHECK (patient_id = public.current_patient_id());

CREATE POLICY clinic_isolation
  ON public.patient_offers
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------------------
-- 5. Capability default: offers.manage
-- ---------------------------------------------------------------------------
-- The owner always holds it; nobody else until the owner grants it from the
-- Team access matrix (a manager, or front desk if they run marketing).
INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::app_role, 'offers.manage', r.enabled
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager', false),
    ('front_desk', false),
    ('practitioner', false)
) AS r(role, enabled)
ON CONFLICT (clinic_id, role, permission) DO NOTHING;
