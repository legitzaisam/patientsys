# Phase 3: server functions, rule evaluator, RBAC, realtime

Branch `e2e_exp`, on top of `e0987c5`. 29 Sep 2026. The task backend: a pure rule evaluator, a pure service (scoping, views, transitions, summary), one I/O module for Supabase, and thin handlers in both `clinic.functions.ts` and its demo twin. Nothing on screen changes yet except that the Patients list's Tasks pills now read from `tasks`.

### pt-p3-01-evaluator

- `src/lib/tasks/evaluate-rules.ts` (new, pure): `evaluateRules(snapshot) → { create, close, escalate, valid }`. The snapshot carries the clinic's enabled rules, every active plan with its `planStepState` facts, every active patient (primary practitioner, last visit, visit count, lifetime spend, next due date, live bookings with their booking time, recent misses, live offer), patient portal messages with the first staff reply after each, portal photo uploads and the open tasks.
  - Seven rules keyed by `rule.key`: `plan_step_overdue` (past `grace_days`, chase for the pool, due on the grace day's evening so it reads "N days late", escalates to the practitioner), `plan_step_due_unbooked` (within 7 days), `no_show` (a missed plan step, or a missed booking for a regular with nothing rebooked), `urgent_portal_question` (keyword triage on unreplied messages inside 7 days; `Reply: “…”` for the patient's practitioner with a 4-hour target), `rebook_window` (regulars whose due date passed ≥ 7 days ago with nothing booked), `lapsing_regular` (≥ 120 days since the last visit, ≥ 2 visits, no live offer; `Approve win-back offer for <first name>` to the owner with lifetime spend), `progress_photos` (shared journal photos inside 7 days on an active plan, due before the next visit).
  - One `dedupe_key` per reason (`plan_step_overdue:<milestone>`, `portal_question:<message>`, `rebook_window:<patient>:<dueDate>`, …). Flood-prone rules (`rebook_window`, `lapsing_regular`) are capped by `conditions.max_open` (defaults 12 / 6) for *new* creations, but every matching key stays `valid`, so a task is never closed for lack of room.
  - Closing: an open rule task whose key is no longer valid closes as `auto_booked` (contact task, patient booked or step booked), `auto_replied` (question, staff replied) or `auto_resolved`; a manual contact task with `auto_close` closes as `auto_booked` once the patient books after it was raised. Escalation: open tasks past `escalate_at` go to the rule's role (owner, or the patient's practitioner), once.
- `tests/unit/evaluate-rules.test.ts`: 9 tests over a hand-built snapshot (due / overdue / grace / wrong booking / no-show / photos / questions / recall cap / lapsing / closes with the right resolution / escalation once). Two fixes on the way: acronyms keep their case when a step title is lower-cased ("PRP Hair"), and a booking's `startsAt` is normalised to canonical ISO before it becomes a due date.

### pt-p3-02-sync-rule-tasks

- `src/lib/tasks/snapshot.ts` (new): `buildRuleSnapshot(rows)` from typed raw rows (patients, treatments, appointments, plans + milestones, messages, journal entries + attachments, offers, tasks) so production and demo derive the same facts; `planFacts()` (shared with the Records builder), `primaryPractitioners()` (plan → next booking → last treatment), `newTaskRow(proposal)`.
- Demo: `demoSyncRuleTasks()` in `clinic.functions.demo.ts` runs the evaluator over the fixture arrays, pushes new rows with a `created` event, applies `planAutoClose` / `planEscalate` and notifies the escalation target; throttled to one pass per 5 s per process. Called at the top of every task read and of `listPatients`.
- Production: `syncRuleTasks(ctx)` in `src/lib/tasks/tasks.server.ts` (new) does the same over bounded queries through the clinic-scoped admin client (appointments from the last 120 days, messages 30 days, journal 14 days, treatments 2 years), inserts one row per proposal and treats a `23505` from the open-only unique index as "another pass got there first", throttled per clinic to 15 s.

### pt-p3-03-list-and-summary

- `src/lib/tasks/service.ts` (new, pure): `TaskRow`, `canSeeTask` (managers everything; practitioners their own, the practitioner pool and their own patients; front desk their own, the front-desk pool and unassigned, never `question`), `inView` for the twelve views, `shapeTask` → the client view model with `dueLabel`, `bucket` and a `can` block (select / delegate / handoff / claim / takeOver / complete / attempt / escalateToClinician / snooze) computed from role and ownership, `groupTasks` (Overdue · Today · Later this week · Later, by priority then due), `summarise` → `TasksSummary` (open / overdue / due today / unassigned / pool / auto-closed this week / by type / per-view counts / team load with overdue / practitioner questions and patients-with-others / front-desk handled, booked, retries).
- Handlers `listTasks({ view?, types?, assigneeId? })` (falls back to the role's first view; `assigneeId` → the manager-only `person` view) and `getTasksSummary()` in both files.

### pt-p3-04-write-handlers

- Transitions in `service.ts` return `{ patch, event }`, the event carrying `previous: snapshotOf(row)` so Undo can restore it: `planAssign`, `planHandOff`, `planClaim`, `planTakeOver`, `planAttempt` (third miss reassigns to the owner and marks it escalated; earlier ones schedule a retry in 2 days at 10:00), `planComplete`, `planAutoClose`, `planSnooze`, `planEscalate`, `planUndo`.
- Handlers in both files: `createTask` (suggested assignee by type when none given; assigning to someone else needs `tasks.assign_any`), `assignTasks` (bulk), `handOffToPool`, `claimTask`, `logTaskAttempt`, `completeTask`, `completeTasks` (bulk, managers), `escalateToClinician`, `snoozeTask`, `undoTaskEvent` (only the latest non-undo event on a task can be undone; by its actor or a manager). Every write records a `task_events` row.

### pt-p3-05-patient-summaries

- Decision: rather than a second 641-row handler, the Records facts ride on `listPatients` as `summary` (the plan's `listPatientSummaries` name is dropped from POLICY). `src/lib/patients/records-rows.ts` (new, pure): `buildRecordsSummaries(rows)` → per patient: `type`, `visitCount`, primary practitioner id + name, `plan` (name, done/total, next step, overdue, phase), `planStep`, `noShowAt`, `openTasks` (type, title, assignee, due label, late), `portal` signal (urgent question → photos → incomplete form → replied → quiet), `pendingOffer`, and up to four `activity` items from portal messages, photo uploads, check-ins, signed forms, attended visits, drafted offers and manual tasks.
- `listPatients` (prod + demo) now reads `openTasks` from `tasks` (label = title, kind = task type; the paperwork item stays) and returns `summary`. The prod side loads the extra rows through `loadRecordsRows(ctx, now)`.
- `listPatientTasks({ patient_id })` (both files) for the drawer and the record panel.
- `listTreatmentPlans` rows gain `risk` (`boardRisk`) and `dueBucket` (`dueBucketKey`) for the Journey board.

### pt-p3-06-recall-adapters

- The six recall handlers keep their names and shapes but read and write `tasks`: `createRecallTask` → one `recall` task per new recipient; `updateRecallTask` → `planAssign`; `setRecallTaskStatus` → complete (`handled`) / attempt (`contacted`) / reopen; `deleteRecallTask` → `cancelled`; `listRecallTasks` / `listOpenRecallTasks` → tasks shaped as the old rows (`legacyRecallRow`: `status` open / contacted / completed, `assigned_label`, `group_id = id`, `patients` join). The offer store's `closeRecallTasks` auto-closes open `recall` / `send_offer` tasks. No code reads `recall_tasks` any more.

### pt-p3-07-rbac-policy-schemas

- `permissions.ts`: keys `tasks.assign_any`, `tasks.handoff`, `tasks.claim`, `tasks.complete` (labels and descriptions, a "Tasks" group) and `view.tasks` (Visibility). `access-catalogue.ts`: page node `tasks` (`/tasks`, `view.tasks`, all staff by default). Demo `rolePermissions`: manager all four; practitioner handoff + complete; front desk claim + complete. `supabase/migrations/20261003000200_tasks_permissions.sql` seeds the same for every clinic.
- `policy.ts`: 13 rows (`listTasks`, `getTasksSummary`, `listPatientTasks` staff; `createTask` staff; `assignTasks` / `completeTasks` → `tasks.assign_any`; `handOffToPool` → `tasks.handoff`; `claimTask` → `tasks.claim`; `logTaskAttempt` / `completeTask` / `escalateToClinician` / `snoozeTask` → `tasks.complete`; `undoTaskEvent` staff). `schemas.ts`: `ListTasks`, `ListPatientTasks`, `CreateTask`, `AssignTasks`, `HandOffToPool`, `ClaimTask`, `LogTaskAttempt`, `CompleteTask`, `CompleteTasks`, `EscalateToClinician`, `SnoozeTask`, `UndoTaskEvent`.
- `check:policy` ok — **197 handlers**; `check:validators` back to the two pre-existing `saveAppointment` problems; `check:tenancy` ok — 62 tables.

### pt-p3-08-notify-realtime

- Notifications `task_assigned` (to the new assignee, with the note) and `task_escalated` (third missed attempt, "Needs clinician", rule escalation) through `demoNotifyStaff` / `notifyStaff`; the actor is never notified about their own change.
- `src/lib/use-tasks-sync.ts` (new): `useTasksLiveSync(patientId?)` subscribes to `tasks` changes in production and polls every 5 s in the demo; `invalidateTaskQueries` covers `tasks`, `tasks-summary`, `patient-tasks`, `patients`, `dashboard`, `recall-tasks`.

### pt-p3-09-verify-commit

Persona probes (`node /tmp/pt-probe-tasks.mjs`, through the running demo app):

| Persona | Probe | Result |
| ------- | ----- | ------ |
| Owner | summary | 57 open · 18 overdue · 1 unassigned · 31 pool · by type recall 22 / chase 10 / rebook 10 / offer 7 / question 6 / support 2; team load per member |
| Owner | `team` view | 4 groups (Overdue 18 · Today 4 · Later this week 28 · Later 7); rows carry type, patient, title, assignee, due label, source line |
| Owner | create → assign → complete → undo | created "Chase booking: Grace" for Sofia, reassigned to Nadia, completed `booked`, undone; Grace's `summary` = skin plan, Dr Nadia Rahman, 3-Month Microneedling Plan |
| Practitioner (Nadia) | views | assigned 8 · questions 2 (incl. "OK to go to the gym the day after session 2?" with "3h 19m left") · patients with others 16; `assignTasks` refused ("You do not have access to this area"); hand off own chase ok; snooze question ok; undo ok |
| Front desk (Sofia) | scope | pool types chase / rebook / recall only, no `question` anywhere; `team` view falls back to `queue` |
| Front desk | claim → 3 attempts | attempts 1, 2 then 3 → `escalated: true`, task left the queue (now the owner's); undo restored it |
| Legacy adapters | `listOpenRecallTasks`, `listRecallTasks` | old row shape with `status` / `assigned_label` / `patients` |

| Check | Result |
| ----- | ------ |
| Unit | 243 passed (+9 evaluator), the 11 pre-existing failures |
| Guards | policy 197 · tenancy 62 · validators 2 pre-existing |
| e2e `patients`, `retention`, `smoke`, `rbac` (Chromium) | 54 / 55; the one failure is the recorded pre-existing `patients:246` (insights period picker) |
| tsc | **107** (two pre-existing errors lived in the replaced recall code); 0 new |
| Lint | delta 0 on `clinic.functions.ts` (212 → 197), `clinic.functions.demo.ts` (110 → 105), `policy.ts`, `permissions.ts`, `access-catalogue.ts`, `schemas.ts`, `data.ts`; new files 0 |
| Commit | see the index |
