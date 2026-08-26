-- Phase 5.2 — make the portal's idea of "which patient am I" deterministic.
--
-- current_patient_id() resolves the signed-in portal user with LIMIT 1 over a
-- non-unique column. Every RLS policy on the patient side is built on it, so
-- if two patient rows ever shared a user_id the portal could show a different
-- person's record between two requests.
--
-- The way that happens is handle_new_user(), which links on email with an
-- unbounded UPDATE: two patient rows sharing an email — a duplicate record, a
-- couple sharing an address, a re-registration — both get the same user_id.
-- Adding UNIQUE without fixing the trigger would convert that silent data bug
-- into a hard signup failure, so both change together.

-- Postgres treats NULLs as distinct here, so the 4 unlinked patients are fine.
ALTER TABLE public.patients
  ADD CONSTRAINT patients_user_id_key UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_clinic uuid;
BEGIN
  SELECT id INTO v_clinic FROM public.clinics ORDER BY created_at LIMIT 1;

  INSERT INTO public.profiles (id, clinic_id, full_name)
  VALUES (NEW.id, v_clinic, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Exactly one row, oldest first: on a duplicate the original record is the
  -- one carrying the treatment history, so that is the one worth linking.
  UPDATE public.patients SET user_id = NEW.id
  WHERE id = (
    SELECT id FROM public.patients
    WHERE user_id IS NULL AND lower(email) = lower(NEW.email)
    ORDER BY created_at
    LIMIT 1
  );

  RETURN NEW;
END;
$function$;

-- Redundant while the constraint above holds, but it keeps the guarantee
-- readable at the point that depends on it rather than three tables away.
CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM public.patients
  WHERE user_id = auth.uid()
  ORDER BY created_at
  LIMIT 1;
$function$;
