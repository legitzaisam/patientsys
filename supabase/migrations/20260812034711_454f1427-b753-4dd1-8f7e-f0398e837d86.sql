ALTER TABLE public.recall_tasks
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS contacted_by uuid,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS status_by_label text;

UPDATE public.recall_tasks SET group_id = id WHERE group_id IS NULL;

CREATE INDEX IF NOT EXISTS recall_tasks_group_idx ON public.recall_tasks (group_id);