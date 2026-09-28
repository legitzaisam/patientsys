-- Two manager-only capabilities behind the redesigned staff profile.
--
--   team.manage_profiles  open a colleague's full profile: edit their details,
--                         working pattern and bookable treatments, approve
--                         their time off. On for managers by default; without
--                         it a manager sees the front-desk view of a colleague.
--   team.commission       see and set a colleague's commission rate and open
--                         their Performance & earnings. On for managers.
--
-- Receptionists and practitioners never hold either (the access grid shows a
-- dash); their rows are seeded off so every clinic has a complete grid.

INSERT INTO public.role_permissions (clinic_id, role, permission, enabled)
SELECT c.id, r.role::public.app_role, r.permission, r.enabled
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('manager',      'team.manage_profiles', true),
    ('manager',      'team.commission',      true),
    ('practitioner', 'team.manage_profiles', false),
    ('practitioner', 'team.commission',      false),
    ('front_desk',   'team.manage_profiles', false),
    ('front_desk',   'team.commission',      false)
) AS r(role, permission, enabled)
ON CONFLICT DO NOTHING;
