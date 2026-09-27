-- A recall task has a date it should be done by. Defaults to a week after it
-- was raised; the dashboard's My tasks shows it.

ALTER TABLE public.recall_tasks
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

UPDATE public.recall_tasks SET due_at = created_at + interval '7 days' WHERE due_at IS NULL;

COMMENT ON COLUMN public.recall_tasks.due_at IS
  'When the chase should be done by. Set on creation (default one week), editable by the creator or a manager.';
