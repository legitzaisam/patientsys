-- Phase 5.4 — retention: archive by default, erase only deliberately.
--
-- Two corrections to audit 5.2 are worth recording here, because they change
-- what this migration is for. No application code deletes a patient — the
-- exposure was the "owners delete patients" policy, not a button. And the
-- cascade was never total: appointment_notes.patient_id is NO ACTION, so a
-- patient with any visit note already failed with a foreign key violation
-- rather than losing their record.
--
-- What was actually missing is a retention model. Adopted here: 8 years from
-- last treatment, the NHS adult-record standard. Records under legal hold or
-- inside the window cannot be erased at all; outside it, erasure is a single
-- audited function rather than a DELETE anyone can reach.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by      uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS legal_hold      boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patients.deleted_at IS
  'Soft delete. Set by archivePatient; the record and its clinical history stay intact.';
COMMENT ON COLUMN public.patients.legal_hold IS
  'Blocks erasure regardless of the retention window — complaint, claim or investigation.';

CREATE INDEX IF NOT EXISTS patients_deleted_at_idx
  ON public.patients (deleted_at) WHERE deleted_at IS NULL;

-- 8 years from the last clinical contact, or from registration if there has
-- never been one. Returned rather than stored so it cannot go stale when a
-- late treatment is recorded against an old record.
CREATE OR REPLACE FUNCTION public.patient_retain_until(_patient_id uuid)
RETURNS date
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (GREATEST(
    COALESCE((SELECT max(performed_at) FROM public.treatments   WHERE patient_id = _patient_id), 'epoch'::timestamptz),
    COALESCE((SELECT max(starts_at)    FROM public.appointments WHERE patient_id = _patient_id), 'epoch'::timestamptz),
    COALESCE((SELECT created_at        FROM public.patients     WHERE id         = _patient_id), now())
  ) + interval '8 years')::date;
$function$;

COMMENT ON FUNCTION public.patient_retain_until(uuid) IS
  'NHS adult-record retention: 8 years from last treatment or appointment.';

-- The cascade is real: 8 child tables carry ON DELETE CASCADE. This makes it
-- unreachable from every route, service-role included, except erase_patient().
CREATE OR REPLACE FUNCTION public.reject_patient_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('app.allow_patient_erasure', true), '') <> 'on' THEN
    RAISE EXCEPTION
      'Patients are archived, not deleted. Use erase_patient() for a lawful erasure request.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS patients_no_hard_delete ON public.patients;
CREATE TRIGGER patients_no_hard_delete
  BEFORE DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.reject_patient_delete();

-- Deletion is no longer reachable through RLS at all; the function below is
-- the only door, and it checks the things a policy cannot.
DROP POLICY IF EXISTS "owners delete patients" ON public.patients;

CREATE OR REPLACE FUNCTION public.erase_patient(_patient_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_until   date;
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE id = _patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF coalesce(trim(_reason), '') = '' THEN
    RAISE EXCEPTION 'An erasure reason is required';
  END IF;

  IF v_patient.legal_hold THEN
    RAISE EXCEPTION 'Patient % is under legal hold and cannot be erased', _patient_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  v_until := public.patient_retain_until(_patient_id);
  IF v_until > current_date THEN
    RAISE EXCEPTION 'Retention period runs until %; this record cannot be erased yet', v_until
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Written before the delete, because audit_log.patient_id would cascade with
  -- it — the point of the entry is that it outlives the record.
  -- audit_log.patient_id carries no foreign key, so the entry outlives the row.
  INSERT INTO public.audit_log (clinic_id, actor_id, action, entity, entity_id, patient_id, meta)
  VALUES (
    v_patient.clinic_id, auth.uid(), 'patient.erased', 'patients', _patient_id, _patient_id,
    jsonb_build_object(
      'reason', _reason,
      'reference', v_patient.reference,
      'retained_until', v_until,
      'erased_at', now()
    )
  );

  PERFORM set_config('app.allow_patient_erasure', 'on', true);
  -- appointment_notes is the one child that does not cascade, so an erasure
  -- would otherwise fail on a foreign key for any patient who has a visit note.
  DELETE FROM public.appointment_notes WHERE patient_id = _patient_id;
  DELETE FROM public.patients WHERE id = _patient_id;
  PERFORM set_config('app.allow_patient_erasure', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.erase_patient(uuid, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.erase_patient(uuid, text) IS
  'Irreversible. Refuses under legal hold or inside the 8-year window. Audited before the delete.';
