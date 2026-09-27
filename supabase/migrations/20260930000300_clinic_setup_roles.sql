-- Owner first-login choice (separate manager or not) and clinic-defined
-- named access packs. Packs are permission copies, not new app_role values.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS has_separate_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_setup_at timestamptz;

COMMENT ON COLUMN public.clinics.has_separate_manager IS
  'True when the clinic intends to have a Manager login, distinct from the owner.';

COMMENT ON COLUMN public.clinics.owner_setup_at IS
  'When the clinic owner finished first-login setup. Null until they do.';

-- Existing clinics already operate; do not trap current owners behind setup.
UPDATE public.clinics
SET owner_setup_at = COALESCE(owner_setup_at, created_at)
WHERE owner_setup_at IS NULL;

UPDATE public.clinics c
SET has_separate_manager = true
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE p.clinic_id = c.id
    AND ur.role = 'manager'
);

CREATE TABLE public.clinic_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_roles IS
  'Clinic-defined access packs (for example Plastic surgeon). Not a new login role.';

CREATE UNIQUE INDEX clinic_roles_name_idx
  ON public.clinic_roles (clinic_id, lower(name));

CREATE TABLE public.clinic_role_permissions (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  clinic_role_id uuid NOT NULL REFERENCES public.clinic_roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_role_id, permission)
);

COMMENT ON TABLE public.clinic_role_permissions IS
  'Permission keys for a clinic-defined named role. Seeded from generic staff defaults.';

CREATE INDEX clinic_role_permissions_clinic_idx
  ON public.clinic_role_permissions (clinic_id, clinic_role_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clinic_role_id uuid REFERENCES public.clinic_roles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.clinic_role_id IS
  'When set, this person uses the named pack instead of the built-in role grants.';

ALTER TABLE public.clinic_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_role_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.clinic_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_role_permissions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_role_permissions TO authenticated;

CREATE POLICY "staff read clinic roles"
  ON public.clinic_roles
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY clinic_isolation
  ON public.clinic_roles
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff read clinic role permissions"
  ON public.clinic_role_permissions
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY clinic_isolation
  ON public.clinic_role_permissions
  AS RESTRICTIVE
  FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
