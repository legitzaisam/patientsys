-- Phase 5.5 — clinic isolation, enforced instead of implied.
--
-- The schema has been shaped for multi-tenancy since the first migration:
-- clinic_id on 19 tables, a clinics table, a CLINIC_ID constant in the app.
-- None of the 94 policies referenced it. That was survivable with one clinic
-- and becomes a cross-tenant breach the day there are two.
--
-- Decision taken with the clinic: one person belongs to exactly one clinic.
-- profiles.clinic_id is the source of truth for staff, patients.clinic_id for
-- the portal. is_staff/is_owner/has_role are deliberately untouched — being
-- staff stays global, and which clinic you are staff *of* comes from your
-- profile. That keeps the identity layer out of this migration entirely.
--
-- Enforcement is one RESTRICTIVE policy per table rather than 94 rewrites.
-- Postgres ANDs restrictive policies with every permissive one, so the effect
-- is identical and reverting is 19 DROP POLICY lines instead of restoring 94
-- definitions from memory.
--
-- Caveat worth stating plainly: this binds nothing for application traffic
-- today, because every request runs on the service-role client which bypasses
-- RLS. The query-level scoping that ships alongside this migration is what
-- actually enforces isolation right now (audit 4.1).

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT clinic_id FROM public.patients WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1)
  );
$function$;

COMMENT ON FUNCTION public.current_clinic_id() IS
  'The caller''s clinic: their staff profile, or the patient record linked to their login.';

-- ---------------------------------------------------------------------------
-- 1. clinic_id becomes mandatory where it already exists.
--    Verified before writing this: zero NULL rows across all 15, so no backfill.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointment_notes', 'appointments', 'audit_log', 'documents',
    'medical_history_versions', 'message_templates', 'messages', 'patients',
    'profile_change_requests', 'profiles', 'recall_tasks', 'retention_outreach',
    'treatment_catalogue', 'treatment_photos', 'treatments'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I SET clinic_id = (SELECT id FROM public.clinics ORDER BY created_at LIMIT 1)
       WHERE clinic_id IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN clinic_id SET NOT NULL', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The three settings tables that had no clinic_id at all. Each held
--    clinic-wide configuration keyed as though there could only ever be one.
-- ---------------------------------------------------------------------------
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.treatment_colours
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.treatment_colour_themes
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

UPDATE public.role_permissions        SET clinic_id = (SELECT id FROM public.clinics ORDER BY created_at LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.treatment_colours       SET clinic_id = (SELECT id FROM public.clinics ORDER BY created_at LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.treatment_colour_themes SET clinic_id = (SELECT id FROM public.clinics ORDER BY created_at LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.role_permissions        ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.treatment_colours       ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.treatment_colour_themes ALTER COLUMN clinic_id SET NOT NULL;

-- Their keys assumed a single clinic too: a second clinic could not have its
-- own permission grid, and could not colour a treatment the first had named.
ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_permission_key;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_clinic_role_permission_key UNIQUE (clinic_id, role, permission);

ALTER TABLE public.treatment_colours DROP CONSTRAINT IF EXISTS treatment_colours_pkey;
ALTER TABLE public.treatment_colours
  ADD CONSTRAINT treatment_colours_pkey PRIMARY KEY (clinic_id, treatment_name);

-- ---------------------------------------------------------------------------
-- 3. One restrictive isolation policy per clinic-scoped table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointment_notes', 'appointments', 'audit_log', 'documents',
    'ex_team_members', 'medical_history_versions', 'message_templates',
    'messages', 'patients', 'profile_change_requests', 'profiles',
    'recall_tasks', 'retention_outreach', 'role_permissions',
    'staff_chat_messages', 'staff_conversations', 'staff_notifications',
    'treatment_catalogue', 'treatment_colour_themes', 'treatment_colours',
    'treatment_photos', 'treatments'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS clinic_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY clinic_isolation ON public.%I AS RESTRICTIVE FOR ALL
         USING (clinic_id = public.current_clinic_id())
         WITH CHECK (clinic_id = public.current_clinic_id())', t);
  END LOOP;
END $$;

-- clinics itself is the tenant, so it scopes by primary key.
DROP POLICY IF EXISTS clinic_isolation ON public.clinics;
CREATE POLICY clinic_isolation ON public.clinics AS RESTRICTIVE FOR ALL
  USING (id = public.current_clinic_id())
  WITH CHECK (id = public.current_clinic_id());

-- staff_documents, user_notes, staff_conversation_reads, user_roles: no
-- clinic_id, and none needed. The first three are scoped to their owning user
-- already, and user_roles says what someone is, not where — which clinic they
-- belong to is answered by their profile, per the decision above.
