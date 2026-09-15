-- Phase 9d — scheduled reminders, call logging and template keys.
--
-- 1. reminder_offsets: hours before an appointment when a reminder goes out.
--    Stored per clinic so the offsets are policy, not code.
-- 2. 'call' on communication_channel: click-to-dial attempts are logged into
--    communications (status 'sent', never 'queued') so outreach history shows
--    calls alongside emails and texts. The drain claims only queued rows, so
--    a call row can never reach a provider adapter.
-- 3. message_templates.key: a stable identifier connecting templates to
--    communications.template_key, unique per clinic where set.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS reminder_offsets integer[] NOT NULL DEFAULT '{168,24}';

ALTER TYPE public.communication_channel ADD VALUE IF NOT EXISTS 'call';

ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS key text;
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_clinic_key_idx
  ON public.message_templates (clinic_id, key)
  WHERE key IS NOT NULL;
