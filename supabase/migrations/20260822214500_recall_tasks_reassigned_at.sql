ALTER TABLE public.recall_tasks
  ADD COLUMN IF NOT EXISTS reassigned_at timestamp with time zone;
