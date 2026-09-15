-- Phase 9 — wire comms to real flows.
--
-- 1. The consent magic link resolves documents by access_token, which has only
--    ever had a random default and no index. Unique: a collision would let one
--    patient open another's consent form.
-- 2. 'cancelled' marks outbox rows superseded by a reschedule or cancellation.
--    The drain claims only 'queued', so cancelled rows are inert by
--    construction and the audit trail keeps what was going to be sent.
-- 3. document_access_events is both the consent evidence (who opened and
--    signed the public link, from where) and the rate-limit source for the
--    public routes. No clinic_id: rows are keyed to their document.

CREATE UNIQUE INDEX IF NOT EXISTS documents_access_token_idx
  ON public.documents (access_token);

ALTER TYPE public.communication_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE TABLE IF NOT EXISTS public.document_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents (id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('view', 'sign', 'rejected')),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Consent evidence reads newest-first per document; the throttle counts
-- recent rows per address.
CREATE INDEX IF NOT EXISTS document_access_events_document_idx
  ON public.document_access_events (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_access_events_ip_idx
  ON public.document_access_events (ip, created_at DESC);

ALTER TABLE public.document_access_events ENABLE ROW LEVEL SECURITY;

-- Service-role only, like auth_login_events: the public routes write through
-- the admin client and staff have no UI on this table yet.
REVOKE ALL ON TABLE public.document_access_events FROM PUBLIC;
REVOKE ALL ON TABLE public.document_access_events FROM anon;
REVOKE ALL ON TABLE public.document_access_events FROM authenticated;
