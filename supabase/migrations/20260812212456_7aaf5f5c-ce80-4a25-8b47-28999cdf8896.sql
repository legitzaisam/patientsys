CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read role permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Managers can insert role permissions"
ON public.role_permissions FOR INSERT TO authenticated
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Managers can update role permissions"
ON public.role_permissions FOR UPDATE TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Managers can delete role permissions"
ON public.role_permissions FOR DELETE TO authenticated
USING (public.is_owner(auth.uid()));

CREATE TRIGGER role_permissions_updated
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('front_desk','reports.retention', false),
  ('front_desk','reports.performance', false),
  ('front_desk','team.view', false),
  ('front_desk','team.approve_changes', false),
  ('front_desk','settings.treatments', false),
  ('front_desk','notifications.delete', false),
  ('front_desk','tasks.delete', false),
  ('practitioner','reports.retention', true),
  ('practitioner','reports.performance', false),
  ('practitioner','team.view', false),
  ('practitioner','team.approve_changes', false),
  ('practitioner','settings.treatments', false),
  ('practitioner','notifications.delete', false),
  ('practitioner','tasks.delete', false);