-- Staff working patterns, time off, the treatments a practitioner can be
-- booked for, and practitioner invoices to the clinic — the four tables the
-- redesigned staff profile reads and writes. Every row carries clinic_id and
-- sits behind the same is_staff + clinic_isolation policies as the other
-- clinic-scoped tables.

-- ---------------------------------------------------------------- patterns

CREATE TABLE public.staff_working_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Monday-first: 0 = Mon … 6 = Sun.
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  -- Null start and end = a day off.
  start_time time,
  end_time time,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_working_patterns_user_weekday_key UNIQUE (user_id, weekday),
  CONSTRAINT staff_working_patterns_both_or_neither CHECK (
    (start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

COMMENT ON TABLE public.staff_working_patterns IS
  'One row per weekday per staff member: the hours the front desk can book them inside. Null times mean a day off.';

CREATE INDEX staff_working_patterns_clinic_user_idx
  ON public.staff_working_patterns (clinic_id, user_id);

-- ---------------------------------------------------------------- time off

CREATE TABLE public.staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('holiday', 'training', 'sickness', 'other')),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  -- A half day at either end takes half a day off the count.
  start_half text NOT NULL DEFAULT 'full' CHECK (start_half IN ('full', 'half')),
  end_half text NOT NULL DEFAULT 'full' CHECK (end_half IN ('full', 'half')),
  -- Working days inside the range per the person's pattern at request time.
  working_days numeric(5, 1) NOT NULL DEFAULT 0,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_time_off IS
  'Holiday, training, sickness and other absences. Staff request; the owner or a manager with Edit staff profiles approves.';

CREATE INDEX staff_time_off_clinic_user_idx
  ON public.staff_time_off (clinic_id, user_id, starts_on);

-- ---------------------------------------------------------------- bookable treatments

CREATE TABLE public.practitioner_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  catalogue_id uuid NOT NULL REFERENCES public.treatment_catalogue(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practitioner_treatments_user_catalogue_key UNIQUE (user_id, catalogue_id)
);

COMMENT ON TABLE public.practitioner_treatments IS
  'The catalogue treatments the front desk can book a practitioner for. Set by the owner or a manager with Edit staff profiles.';

CREATE INDEX practitioner_treatments_clinic_user_idx
  ON public.practitioner_treatments (clinic_id, user_id);

-- ---------------------------------------------------------------- invoices

CREATE TABLE public.practitioner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- INV-<initials>-YYYY-MM
  number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  recipient text NOT NULL CHECK (recipient IN ('payroll', 'owner')),
  note text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'paid')),
  -- When a scheduled invoice goes out (the 1st of the next month); null once sent.
  scheduled_for date,
  sent_at timestamptz,
  paid_at timestamptz,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  treatments integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practitioner_invoices_user_period_key UNIQUE (user_id, period_start)
);

COMMENT ON TABLE public.practitioner_invoices IS
  'A self-employed practitioner''s monthly invoice to the clinic for their share of treatments delivered. One per person per month.';

CREATE INDEX practitioner_invoices_clinic_user_idx
  ON public.practitioner_invoices (clinic_id, user_id, period_start DESC);

CREATE INDEX practitioner_invoices_due_idx
  ON public.practitioner_invoices (scheduled_for)
  WHERE status = 'scheduled';

-- ---------------------------------------------------------------- access

ALTER TABLE public.staff_working_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner_invoices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_working_patterns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.staff_time_off FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.practitioner_treatments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.practitioner_invoices FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_working_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_time_off TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.practitioner_treatments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.practitioner_invoices TO authenticated;

-- Staff read and write through the server functions, which decide who may
-- touch whose rows; RLS keeps every clinic to its own rows.
CREATE POLICY "staff use working patterns"
  ON public.staff_working_patterns FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.staff_working_patterns AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff use time off"
  ON public.staff_time_off FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.staff_time_off AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff use practitioner treatments"
  ON public.practitioner_treatments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.practitioner_treatments AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff use practitioner invoices"
  ON public.practitioner_invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.practitioner_invoices AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());
