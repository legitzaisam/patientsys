-- Per-user dismiss from the Team messages inbox (does not delete the row for the other party).
ALTER TABLE public.staff_notifications
  ADD COLUMN IF NOT EXISTS recipient_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_dismissed_at timestamptz;
