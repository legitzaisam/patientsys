-- Working-pattern change requests. A staff member proposes new hours from
-- their profile; the clinic owner (or a manager holding Edit staff profiles)
-- approves, which writes the seven staff_working_patterns rows, or declines.
-- A non-owner manager's own request goes to the owner (requires_owner).
-- Same access shape as staff_time_off: is_staff + clinic_isolation.

CREATE TABLE public.staff_pattern_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Seven proposed rows, Monday-first: [{ "weekday": 0..6, "start": "09:00" | null, "end": "17:30" | null }, …].
  rows jsonb NOT NULL,
  note text,
  requires_owner boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_pattern_requests_rows_is_array CHECK (jsonb_typeof(rows) = 'array')
);

COMMENT ON TABLE public.staff_pattern_requests IS
  'Proposed working patterns awaiting approval. Approving replaces the person''s staff_working_patterns rows; only one pending request per person at a time (a new one withdraws the old).';

CREATE INDEX staff_pattern_requests_clinic_user_idx
  ON public.staff_pattern_requests (clinic_id, user_id, requested_at DESC);

CREATE INDEX staff_pattern_requests_pending_idx
  ON public.staff_pattern_requests (clinic_id)
  WHERE status = 'pending';

-- ---------------------------------------------------------------- access

ALTER TABLE public.staff_pattern_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_pattern_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_pattern_requests TO authenticated;

-- Staff read and write through the server functions, which decide who may
-- request for whom and who may review; RLS keeps every clinic to its own rows.
CREATE POLICY "staff use pattern requests"
  ON public.staff_pattern_requests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.staff_pattern_requests AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());
