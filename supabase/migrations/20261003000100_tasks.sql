-- Tasks: one list of things somebody has to do for a patient, fed by rules
-- (plan step overdue, urgent portal question, rebook window, no-show, lapsing
-- regular, progress photos), by the portal and by hand. Replaces recall_tasks
-- (migrated below as type 'recall') and the derived chase / follow-up / call
-- queue surfaces. task_events is the audit trail and powers Undo;
-- automation_rules holds the six rules the evaluator runs when tasks are read.
-- Same access shape as staff_pattern_requests: is_staff + clinic_isolation,
-- with the finer who-sees-what (assignee, pool, own patients, questions hidden
-- from front desk) decided in the server functions.

CREATE TYPE public.task_type AS ENUM (
  'chase_booking', 'recall', 'question', 'send_offer', 'plan_support', 'rebook_no_show', 'custom'
);
CREATE TYPE public.task_status AS ENUM ('open', 'snoozed', 'done', 'auto_closed', 'cancelled');
CREATE TYPE public.task_source AS ENUM ('rule', 'portal', 'manual');

-- ---------------------------------------------------------------- rules

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Stable key the evaluator switches on: plan_step_overdue | plan_step_due_unbooked |
  -- urgent_portal_question | rebook_window | no_show | lapsing_regular | progress_photos
  key text NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL DEFAULT 'create_task',
  task_type public.task_type,
  -- patient_practitioner | owner | front_desk_pool | person
  assign_strategy text NOT NULL,
  assign_person uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_offset_hours integer NOT NULL DEFAULT 24,
  escalate_after_hours integer,
  escalate_to_role text,
  -- Events that close the task without anyone touching it: appointment.booked | portal.replied | plan.step_done
  resolve_on text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_rules_clinic_key UNIQUE (clinic_id, key)
);

COMMENT ON TABLE public.automation_rules IS
  'Per-clinic automation rules. The task evaluator runs every enabled rule when tasks are read, creating open tasks keyed by dedupe_key and auto-closing them when the resolving condition is met.';

-- ---------------------------------------------------------------- tasks

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type public.task_type NOT NULL,
  title text NOT NULL,
  -- "Skin plan step 65 days overdue · 2 reminders unanswered"
  context text,
  source public.task_source NOT NULL DEFAULT 'manual',
  -- Rule name or "Assigned by Dr Amara Osei"
  source_label text,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  -- e.g. 'plan_step_overdue:<milestone_id>'; unique while open so one reason makes one task
  dedupe_key text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- null assignee + a role = pooled: 'front_desk' | 'practitioner' | 'manager'
  assignee_role text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text,
  priority smallint NOT NULL DEFAULT 2,
  due_at timestamptz,
  escalate_at timestamptz,
  escalated_at timestamptz,
  escalated_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempts smallint NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  snoozed_until timestamptz,
  status public.task_status NOT NULL DEFAULT 'open',
  -- 'booked' | 'will_book' | 'no_answer' | 'voicemail' | 'not_continuing' | 'replied' | 'approved' | 'handled' | 'auto_booked' | 'auto_replied' | …
  resolution text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  -- Close automatically when the patient books or replies (manual tasks can opt out)
  auto_close boolean NOT NULL DEFAULT true,
  -- {milestone_id, plan_id, appointment_id, offer_id, message_id, recall_task_id}
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_assignee_role_check
    CHECK (assignee_role IS NULL OR assignee_role IN ('front_desk', 'practitioner', 'manager')),
  CONSTRAINT tasks_priority_check CHECK (priority BETWEEN 1 AND 3)
);

COMMENT ON TABLE public.tasks IS
  'One thing somebody has to do for one patient. Replaces recall_tasks; rule tasks are created and auto-closed by the evaluator, manual ones through the Assign dialog. Completing a task once clears it from the Tasks page, the dashboard aggregate and the patient drawer.';

CREATE UNIQUE INDEX tasks_open_dedupe
  ON public.tasks (clinic_id, dedupe_key)
  WHERE status IN ('open', 'snoozed') AND dedupe_key IS NOT NULL;
CREATE INDEX tasks_clinic_open_due ON public.tasks (clinic_id, due_at) WHERE status IN ('open', 'snoozed');
CREATE INDEX tasks_assignee_open ON public.tasks (assignee_id, due_at) WHERE status IN ('open', 'snoozed');
CREATE INDEX tasks_pool_open
  ON public.tasks (clinic_id, assignee_role, due_at)
  WHERE status IN ('open', 'snoozed') AND assignee_id IS NULL;
CREATE INDEX tasks_patient ON public.tasks (patient_id, created_at DESC);
CREATE INDEX tasks_resolved ON public.tasks (clinic_id, resolved_at DESC) WHERE status IN ('done', 'auto_closed');

-- ---------------------------------------------------------------- events

CREATE TABLE public.task_events (
  id bigserial PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  -- null = system / rule
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- created | assigned | reassigned | claimed | handed_off | attempt | snoozed | escalated | done | auto_closed | reopened | note | undone
  kind text NOT NULL,
  -- What changed, and the previous {assignee_id, assignee_role, status, attempts, next_retry_at, resolution} so Undo can restore it
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.task_events IS
  'Audit trail for tasks. Every write through the server functions inserts one row carrying the previous state, which the Undo toast restores.';

CREATE INDEX task_events_task ON public.task_events (task_id, created_at DESC);
CREATE INDEX task_events_clinic_recent ON public.task_events (clinic_id, created_at DESC);

-- ---------------------------------------------------------------- access

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.automation_rules, public.tasks, public.task_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automation_rules, public.tasks, public.task_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.task_events_id_seq TO authenticated;
GRANT ALL ON TABLE public.automation_rules, public.tasks, public.task_events TO service_role;
GRANT ALL ON SEQUENCE public.task_events_id_seq TO service_role;

-- Staff read and write through the server functions, which decide who sees
-- which tasks (assignee, front-desk pool, own patients; clinical questions
-- never reach front desk) and who may assign, claim, hand off or complete.
-- RLS keeps every clinic to its own rows.
CREATE POLICY "staff use automation rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.automation_rules AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff use tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.tasks AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "staff use task events"
  ON public.task_events FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY clinic_isolation
  ON public.task_events AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------- seed rules

-- The six rules from the design hand-off, one set per clinic. The evaluator
-- keys on `key`; names and copy are what staff see on the source line.
INSERT INTO public.automation_rules
  (clinic_id, key, name, trigger, conditions, task_type, assign_strategy, due_offset_hours, escalate_after_hours, escalate_to_role, resolve_on)
SELECT c.id, r.key, r.name, r.trigger, r.conditions::jsonb, r.task_type::public.task_type, r.assign_strategy,
       r.due_offset_hours, r.escalate_after_hours, r.escalate_to_role, r.resolve_on::text[]
FROM public.clinics c
CROSS JOIN (VALUES
  ('plan_step_overdue', 'Skin plan step overdue', 'plan.step_overdue',
   '{"grace_days": 2}', 'chase_booking', 'front_desk_pool', 24, 48, 'practitioner', '{appointment.booked,plan.step_done}'),
  ('plan_step_due_unbooked', 'Skin plan step due, not booked', 'plan.step_due',
   '{"within_days": 7}', 'chase_booking', 'front_desk_pool', 24, NULL, NULL, '{appointment.booked,plan.step_done}'),
  ('urgent_portal_question', 'Urgent portal question', 'portal.message',
   '{"triage": "urgent"}', 'question', 'patient_practitioner', 4, 4, 'owner', '{portal.replied}'),
  ('rebook_window', 'Rebook window opens', 'patient.rebook_window',
   '{"nudge_days": 7}', 'recall', 'front_desk_pool', 48, NULL, NULL, '{appointment.booked}'),
  ('no_show', 'No-show', 'appointment.no_show',
   '{}', 'rebook_no_show', 'front_desk_pool', 8, 24, 'owner', '{appointment.booked}'),
  ('lapsing_regular', 'Lapsing regular', 'schedule.nightly',
   '{"lapse_days": 120}', 'send_offer', 'owner', 72, NULL, NULL, '{appointment.booked,offer.sent}'),
  ('progress_photos', 'Progress photos uploaded', 'portal.photos_uploaded',
   '{"on_active_plan": true}', 'plan_support', 'patient_practitioner', 72, NULL, NULL, '{plan.step_done}')
) AS r(key, name, trigger, conditions, task_type, assign_strategy, due_offset_hours, escalate_after_hours, escalate_to_role, resolve_on)
ON CONFLICT (clinic_id, key) DO NOTHING;

-- ---------------------------------------------------------------- migrate recall_tasks

-- Every recall task becomes a 'recall' task. Open and contacted stay open
-- (contacted keeps its attempt count), completed become done. The old row id
-- is kept in links so nothing that still references recall_tasks is lost.
INSERT INTO public.tasks
  (clinic_id, patient_id, type, title, note, source, source_label, assignee_id, assignee_role, created_by,
   status, resolution, resolved_by, resolved_at, attempts, due_at, auto_close, links, created_at, updated_at)
SELECT
  r.clinic_id,
  r.patient_id,
  'recall',
  COALESCE(NULLIF(left(btrim(r.note), 80), ''), 'Follow up and rebook'),
  r.note,
  'manual',
  'Follow-up',
  r.assigned_to,
  CASE WHEN r.assigned_to IS NULL THEN 'front_desk' ELSE NULL END,
  r.created_by,
  CASE r.status::text WHEN 'completed' THEN 'done'::public.task_status ELSE 'open'::public.task_status END,
  CASE r.status::text WHEN 'completed' THEN 'handled' ELSE NULL END,
  CASE r.status::text WHEN 'completed' THEN r.completed_by ELSE NULL END,
  CASE r.status::text WHEN 'completed' THEN r.completed_at ELSE NULL END,
  CASE r.status::text WHEN 'contacted' THEN 1 ELSE 0 END,
  COALESCE(r.due_at, r.created_at + interval '7 days'),
  true,
  jsonb_build_object('recall_task_id', r.id, 'group_id', r.group_id),
  r.created_at,
  r.updated_at
FROM public.recall_tasks r
WHERE r.clinic_id IS NOT NULL;

COMMENT ON TABLE public.recall_tasks IS
  'Deprecated 3 Oct 2026: superseded by public.tasks (type recall). Rows were copied across in 20261003000100_tasks.sql and are kept for history; nothing writes here any more.';
