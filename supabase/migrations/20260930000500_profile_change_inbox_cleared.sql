-- Finished profile-change cards can be cleared from the shared inbox
-- without deleting the request from the staff member's own history.
ALTER TABLE public.profile_change_requests
  ADD COLUMN inbox_cleared_at timestamptz;

COMMENT ON COLUMN public.profile_change_requests.inbox_cleared_at IS
  'When set, the reviewed request is hidden from the Team inbox. The requester still sees it on My profile.';
