# Phase 2: schema, types, tenancy, demo fixtures

Branch `e2e_exp`, on top of `9fb4213`. 29 Sep 2026. The three tables the Tasks page reads and writes, their TypeScript rows, the tenancy classification, and the demo fixtures the evaluator and the handlers will work on.

### pt-p2-01-migration

- `supabase/migrations/20261003000100_tasks.sql` (new):
  - Enums `task_type` (`chase_booking, recall, question, send_offer, plan_support, rebook_no_show, custom`), `task_status` (`open, snoozed, done, auto_closed, cancelled`), `task_source` (`rule, portal, manual`).
  - `automation_rules`: per-clinic rules keyed by a stable `key` the evaluator switches on (`UNIQUE (clinic_id, key)`), with `trigger`, `conditions` jsonb, `task_type`, `assign_strategy` (`patient_practitioner | owner | front_desk_pool | person`), `due_offset_hours`, `escalate_after_hours`, `escalate_to_role`, `resolve_on text[]`.
  - `tasks`: the hand-off's columns (`type, title, context, source, source_label, rule_id, dedupe_key, assignee_id, assignee_role, created_by, note, priority, due_at, escalate_at, escalated_at, escalated_to, attempts, next_retry_at, snoozed_until, status, resolution, resolved_by, resolved_at, auto_close, links`). Indexes: the open-only unique `tasks_open_dedupe (clinic_id, dedupe_key) WHERE status IN ('open','snoozed')` so one reason makes one task, plus assignee / pool / patient / resolved indexes.
  - `task_events`: bigserial audit rows (`kind`, `data` with the previous state for Undo).
  - Access in the house shape (`staff_pattern_requests`): RLS on, `REVOKE … FROM PUBLIC, anon, authenticated`, `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` (+ the sequence), `"staff use …"` policies on `is_staff(auth.uid())` and a RESTRICTIVE `clinic_isolation` policy on `current_clinic_id()`. The hand-off's finer who-sees-what (assignee, front-desk pool, own patients, questions hidden from front desk) is decided in the server functions, the way every other table here works.
  - Seed: the six hand-off rules plus "Progress photos uploaded" inserted for every clinic (`ON CONFLICT DO NOTHING`).
  - Migration of `recall_tasks`: every row becomes a `recall` task (`open` / `contacted` stay open with `attempts` 1 for contacted; `completed` → `done` with `resolution 'handled'`), `links` keeps `recall_task_id` and `group_id`, `due_at` defaults to created + 7 days. `recall_tasks` stays in place with a deprecation `COMMENT`; nothing destructive.

### pt-p2-02-types-scope

- `src/integrations/supabase/types.ts`: `automation_rules`, `task_events` and `tasks` table blocks (Row / Insert / Update / Relationships in the generated style, alphabetical) and the three enums in both the `Enums` type and the `Constants` block. The file was not Prettier-clean before this change and is left as it was apart from the new blocks.
- `src/lib/auth/clinic-scope.server.ts`: `automation_rules`, `task_events`, `tasks` added to `CLINIC_SCOPED_TABLES` (alphabetical). `check:tenancy`: **62 tables classified (53 clinic-scoped, 9 exempt)**.

### pt-p2-03-demo-fixtures

- `src/lib/demo/data.ts`, new block after the recall fixtures, exported on `db` as `automationRules`, `tasks`, `taskEvents`:
  - `automationRules`: the same seven rules as the SQL seed.
  - `tasks`: the 13 recall rows collapsed to one task per `group_id` (12 recall tasks, the way the dashboard's Follow-up card collapsed shared groups), `source 'manual'`, `source_label "Assigned by <creator>"`, `links.recall_task_id` / `group_id`; a `created` event each.
  - Four manual tasks with the mockup's copy, created by Dr Amara Osei: Harriet Blackwood's "Re-engagement call" (chase, assigned to Nadia, with the note "A personal call from you works best…", 2 days late and escalated), Beatrice Ashcombe's "Call about filler swelling" (plan support, Nadia, Thursday), Aisha Bello's "Send referral thank-you voucher" (send offer, owner, Friday), and Sienna Clarke's "Chase to book skin consultation" (fully unassigned, so the Unassigned view has a row).
  - Two urgent portal questions as unread patient messages sent 40 and 38 minutes ago: Poppy Trevelyan "OK to go to the gym the day after session 2?" and Isabella Rossi "Is redness on day 3 normal? It started yesterday evening." The urgent-question rule turns them into `question` tasks for Nadia and Tom in P3.
  - `addTaskEvent(taskId, kind, actorId, data, at)` is exported for the demo handlers.
- Probe (`npx tsx`): 7 rules, 16 tasks (16 open), 1 unassigned, 0 pooled, the four manual tasks on the intended patients, both urgent messages on the intended patients. The rule tasks (plan step overdue / due, no-show, lapsing, rebook window) are not in the fixture: the evaluator derives them from the existing plans, appointments and treatments, which is what proves it.
- Only my hunk was run through Prettier (extracted, formatted, re-inserted); the surrounding pre-existing lines are untouched.

### pt-p2-04-verify-commit

| Check | Result |
| ----- | ------ |
| `check:policy` | ok, 184 handlers |
| `check:tenancy` | ok, 62 tables |
| `check:validators` | the two pre-existing `saveAppointment` problems only |
| Unit | 234 passed, the 11 pre-existing failures |
| tsc | 109 = baseline |
| Lint | `data.ts` base 69 now 69 new 0; `clinic-scope.server.ts` 1/1/0; `types.ts` 1/1/0 |
| Commit | see the index |
