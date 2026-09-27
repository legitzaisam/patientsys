-- A reply to a team alert points at the alert it answers, so both threads can quote it.
ALTER TABLE public.staff_notifications
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.staff_notifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS staff_notifications_reply_to_id_idx
  ON public.staff_notifications (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
