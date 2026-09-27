-- Profile-change approval stays with the clinic owner unless they grant it.
-- Unedited manager seeds were on; leave any owner-made grant as they set it.

UPDATE public.role_permissions
SET enabled = false
WHERE role = 'manager'
  AND permission = 'team.approve_changes'
  AND enabled = true
  AND updated_by IS NULL;
