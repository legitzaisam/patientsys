-- Attachments on staff 1:1 chat messages (same shape as patient messages).
ALTER TABLE public.staff_chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.staff_chat_messages
  DROP CONSTRAINT IF EXISTS staff_chat_messages_body_len;

ALTER TABLE public.staff_chat_messages
  ADD CONSTRAINT staff_chat_messages_body_len
  CHECK (char_length(body) BETWEEN 0 AND 4000);
