-- Phase 7 — communications outbox and patient PECR preferences.
--
-- Nothing is dispatched here. Phase 8 drains `communications` where
-- status = 'queued'. This migration only creates the durable store, the
-- consent columns, and renames recall "sent" (which meant "task assigned")
-- to "open".
--
-- Writes are service-role only. authenticated may SELECT. anon gets nothing.
-- clinic_isolation is the same RESTRICTIVE shape as Phase 5.

-- ---------------------------------------------------------------------------
-- 1. Enums and outbox
-- ---------------------------------------------------------------------------
CREATE TYPE public.communication_channel AS ENUM ('email', 'sms');
CREATE TYPE public.communication_status AS ENUM (
  'queued',
  'sending',
  'sent',
  'failed',
  'bounced'
);
CREATE TYPE public.communication_purpose AS ENUM (
  'transactional',
  'reminder',
  'marketing'
);

CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  channel public.communication_channel NOT NULL,
  purpose public.communication_purpose NOT NULL,
  to_address text NOT NULL,
  template_key text,
  subject text,
  body text NOT NULL,
  status public.communication_status NOT NULL DEFAULT 'queued',
  provider text,
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_entity text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.communications IS
  'Durable email/SMS outbox. Application traffic inserts only through enqueueCommunication(); Phase 8 drains queued rows.';

CREATE INDEX communications_drain_idx
  ON public.communications (status, scheduled_for);

CREATE INDEX communications_patient_idx
  ON public.communications (clinic_id, patient_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Patient comms preferences (PECR: marketing opt-in, reminders opt-out)
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN email_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN reminders_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN unsubscribed_at timestamptz;

COMMENT ON COLUMN public.patients.email_opt_in IS
  'Channel consent for marketing email. Transactional and reminder mail do not require this.';
COMMENT ON COLUMN public.patients.sms_opt_in IS
  'Channel consent for marketing SMS. Transactional and reminder texts do not require this.';
COMMENT ON COLUMN public.patients.reminders_opt_in IS
  'Opt-out for appointment and recall reminders. Default on.';
COMMENT ON COLUMN public.patients.marketing_opt_in IS
  'PECR marketing opt-in. Default off.';
COMMENT ON COLUMN public.patients.unsubscribed_at IS
  'Set when marketing and reminders are both off. Transactional sends still go.';

-- ---------------------------------------------------------------------------
-- 3. Manual outreach log may point at an outbox row (Phase 9)
-- ---------------------------------------------------------------------------
ALTER TABLE public.retention_outreach
  ADD COLUMN communication_id uuid REFERENCES public.communications(id) ON DELETE SET NULL;

COMMENT ON TABLE public.retention_outreach IS
  'Manual contact log (phone, mailto, portal message). Not a delivery receipt — that lives on communications.';

-- ---------------------------------------------------------------------------
-- 4. Recall "sent" meant "task assigned". Rename so it stops looking like mail.
-- ---------------------------------------------------------------------------
ALTER TYPE public.recall_task_status RENAME VALUE 'sent' TO 'open';

-- ---------------------------------------------------------------------------
-- 5. Grants and RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.communications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.communications TO authenticated;

CREATE POLICY "staff read communications"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "patients read own communications"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY clinic_isolation
  ON public.communications
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
