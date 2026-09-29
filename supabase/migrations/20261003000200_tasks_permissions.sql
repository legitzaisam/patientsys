-- Capabilities and visibility for the Tasks page. Managers delegate to anyone
-- and mark handled for others; practitioners hand chases to the front desk and
-- close their own; front desk claims from the pool and logs call outcomes.
-- Every staff role can open the page. Owners hold every key in code.

INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::public.app_role, r.permission, r.enabled
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager', 'view.tasks', true),
    ('practitioner', 'view.tasks', true),
    ('front_desk', 'view.tasks', true),
    ('manager', 'tasks.assign_any', true),
    ('manager', 'tasks.handoff', true),
    ('manager', 'tasks.claim', true),
    ('manager', 'tasks.complete', true),
    ('practitioner', 'tasks.assign_any', false),
    ('practitioner', 'tasks.handoff', true),
    ('practitioner', 'tasks.claim', false),
    ('practitioner', 'tasks.complete', true),
    ('front_desk', 'tasks.assign_any', false),
    ('front_desk', 'tasks.handoff', false),
    ('front_desk', 'tasks.claim', true),
    ('front_desk', 'tasks.complete', true)
) AS r(role, permission, enabled)
ON CONFLICT (clinic_id, role, permission) DO NOTHING;
