-- Phase 5.3 — a signed consent stops being editable.
--
-- "staff edit documents" grants unrestricted UPDATE, and the patient-side
-- policy is column-unrestricted too, so nothing stopped body, signature_data
-- or signed_at being rewritten after the fact. For an artefact whose entire
-- purpose is to evidence informed consent at a point in time, that is the
-- whole value gone.
--
-- This is the one control in Phase 5 that binds today's traffic. Triggers fire
-- for the service-role client; policies do not. Everything else in this phase
-- that touches RLS is defence-in-depth until audit 4.1 is addressed.
--
-- Sending a fresh copy is still allowed: resendDocument only writes sent_at,
-- and superseding a consent means inserting a new row, not editing the old.

CREATE OR REPLACE FUNCTION public.reject_signed_document_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- erase_patient() sets this for the duration of a lawful erasure, which is
    -- the only path allowed to take a signed consent with it.
    IF OLD.status = 'signed'
       AND coalesce(current_setting('app.allow_patient_erasure', true), '') <> 'on' THEN
      RAISE EXCEPTION 'Signed consent documents cannot be deleted (document %)', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'signed' AND (
       NEW.status         IS DISTINCT FROM OLD.status
    OR NEW.body           IS DISTINCT FROM OLD.body
    OR NEW.title          IS DISTINCT FROM OLD.title
    OR NEW.kind           IS DISTINCT FROM OLD.kind
    OR NEW.patient_id     IS DISTINCT FROM OLD.patient_id
    OR NEW.signature_data IS DISTINCT FROM OLD.signature_data
    OR NEW.signed_at      IS DISTINCT FROM OLD.signed_at
    OR NEW.signed_name    IS DISTINCT FROM OLD.signed_name
    OR NEW.signed_ip      IS DISTINCT FROM OLD.signed_ip
  ) THEN
    RAISE EXCEPTION 'Signed consent documents cannot be altered (document %)', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS documents_signed_immutable ON public.documents;
CREATE TRIGGER documents_signed_immutable
  BEFORE UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.reject_signed_document_change();
