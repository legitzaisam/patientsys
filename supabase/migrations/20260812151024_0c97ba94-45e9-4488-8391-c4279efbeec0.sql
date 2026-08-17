ALTER TABLE public.staff_notifications
  ADD COLUMN IF NOT EXISTS sender_id uuid,
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;