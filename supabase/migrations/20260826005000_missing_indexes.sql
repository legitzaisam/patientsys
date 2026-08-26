-- Phase 5.6 — the nine indexes from audit 5.8.
--
-- Every one of these matches a filter or sort that runs on a page load today.
-- At 5 patients none of it matters; the demo fixture models 635, and at that
-- volume the dashboard's unbounded scans are the slowest path in the app.

-- .gte("performed_at", ...) range scans: dashboard, performance, retention.
CREATE INDEX IF NOT EXISTS treatments_performed_at_idx
  ON public.treatments (performed_at);

-- The unread-message badge: .eq("author","patient").is("read_at", null).
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (author, read_at, created_at DESC);

-- The patient directory's default sort.
CREATE INDEX IF NOT EXISTS patients_name_idx
  ON public.patients (last_name, first_name);

-- Outstanding consents: .in("status",["sent","viewed"]).order("sent_at").
CREATE INDEX IF NOT EXISTS documents_status_sent_idx
  ON public.documents (status, sent_at);

-- Patient-submitted history awaiting review.
CREATE INDEX IF NOT EXISTS mhv_source_created_idx
  ON public.medical_history_versions (source, created_at DESC);

-- Role lookups: is_staff(), is_owner() and every identity load run this.
CREATE INDEX IF NOT EXISTS user_roles_role_idx
  ON public.user_roles (role);

-- The double-booking pre-check, which runs before every save.
CREATE INDEX IF NOT EXISTS appointments_clinic_practitioner_starts_idx
  ON public.appointments (clinic_id, practitioner_id, starts_at);

-- "Next appointment" on the patient record.
CREATE INDEX IF NOT EXISTS appointments_patient_status_starts_idx
  ON public.appointments (patient_id, status, starts_at);

-- New-patient counts on the dashboard and retention pages.
CREATE INDEX IF NOT EXISTS patients_created_at_idx
  ON public.patients (created_at);
