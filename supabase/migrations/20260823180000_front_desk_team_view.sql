-- Reception may see the team roster and essential-doc status (not file contents).
UPDATE public.role_permissions
SET enabled = true, updated_at = now()
WHERE role = 'front_desk' AND permission = 'team.view';
