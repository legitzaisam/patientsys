-- Direct staff-to-staff chat with conversation-level read receipts.

CREATE TABLE IF NOT EXISTS public.staff_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Canonical pair ordering so each duo has one thread.
  user_low uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_conversations_ordered CHECK (user_low < user_high),
  CONSTRAINT staff_conversations_pair UNIQUE (clinic_id, user_low, user_high)
);

CREATE TABLE IF NOT EXISTS public.staff_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.staff_conversations(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_chat_messages_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE TABLE IF NOT EXISTS public.staff_conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.staff_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS staff_chat_messages_thread_idx
  ON public.staff_chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS staff_conversations_user_low_idx
  ON public.staff_conversations (clinic_id, user_low);
CREATE INDEX IF NOT EXISTS staff_conversations_user_high_idx
  ON public.staff_conversations (clinic_id, user_high);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_conversations TO authenticated;
GRANT ALL ON public.staff_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_chat_messages TO authenticated;
GRANT ALL ON public.staff_chat_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_conversation_reads TO authenticated;
GRANT ALL ON public.staff_conversation_reads TO service_role;

ALTER TABLE public.staff_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own conversations" ON public.staff_conversations;
CREATE POLICY "Staff read own conversations"
  ON public.staff_conversations FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND (user_low = auth.uid() OR user_high = auth.uid())
  );

DROP POLICY IF EXISTS "Staff create conversations they join" ON public.staff_conversations;
CREATE POLICY "Staff create conversations they join"
  ON public.staff_conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (user_low = auth.uid() OR user_high = auth.uid())
  );

DROP POLICY IF EXISTS "Staff update own conversations" ON public.staff_conversations;
CREATE POLICY "Staff update own conversations"
  ON public.staff_conversations FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND (user_low = auth.uid() OR user_high = auth.uid())
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (user_low = auth.uid() OR user_high = auth.uid())
  );

DROP POLICY IF EXISTS "Staff read messages in their threads" ON public.staff_chat_messages;
CREATE POLICY "Staff read messages in their threads"
  ON public.staff_chat_messages FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.staff_conversations c
      WHERE c.id = conversation_id
        AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff send messages in their threads" ON public.staff_chat_messages;
CREATE POLICY "Staff send messages in their threads"
  ON public.staff_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_conversations c
      WHERE c.id = conversation_id
        AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff read own read-receipts" ON public.staff_conversation_reads;
CREATE POLICY "Staff read own read-receipts"
  ON public.staff_conversation_reads FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.staff_conversations c
      WHERE c.id = conversation_id
        AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff upsert own read-receipts" ON public.staff_conversation_reads;
CREATE POLICY "Staff upsert own read-receipts"
  ON public.staff_conversation_reads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_conversations c
      WHERE c.id = conversation_id
        AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff update own read-receipts" ON public.staff_conversation_reads;
CREATE POLICY "Staff update own read-receipts"
  ON public.staff_conversation_reads FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) AND user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_conversation_reads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
