-- Add a distinct manager tier below clinic owner.
-- Owners keep full access; managers get capabilities from role_permissions.
--
-- New enum values must be committed before they can be used. If your migrator
-- wraps the whole file in one transaction, run the ADD VALUE block alone first.

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE 'manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'manager', 'practitioner', 'front_desk')
  );
$$;

INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
  ('manager', 'reports.retention', true),
  ('manager', 'reports.performance', true),
  ('manager', 'team.view', true),
  ('manager', 'team.approve_changes', true),
  ('manager', 'settings.treatments', true),
  ('manager', 'notifications.delete', true),
  ('manager', 'tasks.delete', true)
ON CONFLICT (role, permission) DO NOTHING;
