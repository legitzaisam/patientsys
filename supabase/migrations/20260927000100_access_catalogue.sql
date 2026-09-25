-- Admin can sign in as staff without becoming a clinic owner.
-- Visibility keys match what each role can open today. The clinic owner has
-- no rows: they hold every key in application code. Admin has no rows either.

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
      AND role IN ('owner', 'manager', 'practitioner', 'front_desk', 'admin')
  );
$$;

INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::public.app_role, r.permission, true
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager', 'view.dashboard'),
    ('practitioner', 'view.dashboard'),
    ('front_desk', 'view.dashboard'),
    ('manager', 'view.dashboard.diary'),
    ('practitioner', 'view.dashboard.diary'),
    ('front_desk', 'view.dashboard.diary'),
    ('manager', 'view.dashboard.attention'),
    ('practitioner', 'view.dashboard.attention'),
    ('front_desk', 'view.dashboard.attention'),
    ('manager', 'view.dashboard.followups'),
    ('practitioner', 'view.dashboard.followups'),
    ('front_desk', 'view.dashboard.followups'),
    ('manager', 'view.dashboard.pauses'),
    ('practitioner', 'view.dashboard.pauses'),
    ('front_desk', 'view.dashboard.pauses'),
    ('manager', 'view.dashboard.journeys'),
    ('practitioner', 'view.dashboard.journeys'),
    ('front_desk', 'view.dashboard.journeys'),
    ('manager', 'view.schedule'),
    ('practitioner', 'view.schedule'),
    ('front_desk', 'view.schedule'),
    ('manager', 'view.patients'),
    ('practitioner', 'view.patients'),
    ('front_desk', 'view.patients'),
    ('manager', 'view.patients.records'),
    ('practitioner', 'view.patients.records'),
    ('front_desk', 'view.patients.records'),
    ('manager', 'view.patients.board'),
    ('practitioner', 'view.patients.board'),
    ('front_desk', 'view.patients.board'),
    ('manager', 'view.patients.record'),
    ('practitioner', 'view.patients.record'),
    ('front_desk', 'view.patients.record'),
    ('manager', 'view.patients.treatments'),
    ('practitioner', 'view.patients.treatments'),
    ('front_desk', 'view.patients.treatments'),
    ('manager', 'view.patients.photos'),
    ('practitioner', 'view.patients.photos'),
    ('front_desk', 'view.patients.photos'),
    ('manager', 'view.patients.documents'),
    ('practitioner', 'view.patients.documents'),
    ('front_desk', 'view.patients.documents'),
    ('manager', 'view.patients.history'),
    ('practitioner', 'view.patients.history'),
    ('front_desk', 'view.patients.history'),
    ('manager', 'view.patients.from_patient'),
    ('practitioner', 'view.patients.from_patient'),
    ('front_desk', 'view.patients.from_patient'),
    ('manager', 'view.patients.contact'),
    ('practitioner', 'view.patients.contact'),
    ('front_desk', 'view.patients.contact'),
    ('manager', 'view.profile'),
    ('practitioner', 'view.profile'),
    ('front_desk', 'view.profile'),
    ('manager', 'view.settings'),
    ('practitioner', 'view.settings'),
    ('front_desk', 'view.settings'),
    ('manager', 'view.team.current'),
    ('practitioner', 'view.team.current'),
    ('front_desk', 'view.team.current'),
    ('manager', 'view.team.former'),
    ('practitioner', 'view.team.former'),
    ('front_desk', 'view.team.former'),
    ('manager', 'view.shell'),
    ('practitioner', 'view.shell'),
    ('front_desk', 'view.shell'),
    ('manager', 'view.shell.dock'),
    ('practitioner', 'view.shell.dock'),
    ('front_desk', 'view.shell.dock'),
    ('manager', 'view.shell.search'),
    ('practitioner', 'view.shell.search'),
    ('front_desk', 'view.shell.search'),
    ('manager', 'view.shell.alerts'),
    ('practitioner', 'view.shell.alerts'),
    ('front_desk', 'view.shell.alerts'),
    ('manager', 'view.insights.pipeline'),
    ('front_desk', 'view.insights.pipeline'),
    ('manager', 'view.insights.book'),
    ('front_desk', 'view.insights.book'),
    ('practitioner', 'view.earnings'),
    ('patient', 'view.portal.home'),
    ('patient', 'view.portal.plan'),
    ('patient', 'view.portal.plan.overview'),
    ('patient', 'view.portal.plan.timeline'),
    ('patient', 'view.portal.plan.journal'),
    ('patient', 'view.portal.plan.routine'),
    ('patient', 'view.portal.clinic'),
    ('patient', 'view.portal.records'),
    ('patient', 'view.portal.appointments'),
    ('patient', 'view.portal.resources'),
    ('patient', 'view.portal.billing'),
    ('patient', 'view.portal.settings'),
    ('patient', 'view.portal.chat')
) AS r(role, permission)
ON CONFLICT (clinic_id, role, permission) DO NOTHING;
