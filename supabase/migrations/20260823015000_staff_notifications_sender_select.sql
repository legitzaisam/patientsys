-- Allow senders to read rows they created (for Sent alerts list + realtime ack toasts).
-- Recipients keep existing select/update policies.

CREATE POLICY "Senders read notifications they sent"
  ON public.staff_notifications
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS staff_notifications_sender_idx
  ON public.staff_notifications (sender_id, created_at DESC);
