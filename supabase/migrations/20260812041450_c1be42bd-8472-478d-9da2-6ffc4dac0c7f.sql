CREATE TABLE public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'appointment',
  title text not null,
  body text,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can create notifications" ON public.staff_notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Recipients read their notifications" ON public.staff_notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Recipients update their notifications" ON public.staff_notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE INDEX staff_notifications_recipient_idx ON public.staff_notifications (recipient_id, read_at, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;