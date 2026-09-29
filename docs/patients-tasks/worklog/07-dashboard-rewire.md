# Phase 7: dashboard aggregation and rewiring the old surfaces

Branch `e2e_exp`, on top of `192844e`. 29 Sep 2026. The dashboard shows what tasks add up to and points at the Tasks page; the record shows what is open for the patient; the no-show dialog and the retention hand-off create tasks; the recall adapters and the surfaces built on them are gone. Captures: [`captures/p7-dashboard/`](../captures/p7-dashboard/) — `dashboard-{owner,practitioner,front-desk}--{laptop-1440,ipad-landscape,ipad-portrait}.jpg`, `summary-{owner,practitioner,front_desk}.jpg` (the card alone), `record-treatments-owner--*.jpg`.

### pt-p7-01-dashboard-summary-card

- `src/components/dashboard/tasks-summary-card.tsx` (new) replaces `follow-up-tasks.tsx` (deleted). Read-only: the headline count ("58 open across the team" for managers, "N open for you" otherwise), "N overdue" in destructive ink and "N due today", one chip per task type with its count (each a link to `/tasks?types=`), then the role's own numbers — managers: every teammate's load bar (open accent-deep, overdue destructive) linking to their list, plus "N in the front desk pool · N unassigned"; practitioners: Clinical questions / Assigned to you / Your patients, with others; front desk: In your queue / Waiting in pool / Booked today / Retries scheduled — and the line "N closed automatically this week when patients booked or replied." An `Open Tasks` button in the section header is the only action. `data-qc="my-tasks"` is kept on the card (`data-open`, `data-overdue`) with the section title "My tasks", so the dashboard-order test still reads it.
- `src/routes/_authenticated/dashboard.tsx`: `<FollowUpTasks />` → `<TasksSummaryCard />` under the same `dashboard-followups` gate. `permissions.ts` / `access-catalogue.ts`: that key's label is now "Tasks summary".

### pt-p7-02-attention-aggregate

- `service.ts` → `taskAttentionItems(rows, viewer, patientPractitioner, now)`: at most two rows — "Tasks — N overdue" (urgent) and "Tasks — N due today" (this week), subtitles like "9 rebooks, 5 chases, 4 questions, 1 recall · past their due time", both linking to `/tasks`; counted over what the viewer can see (`canSeeTask`).
- `getDashboard` (prod + demo): the per-step "Skin-plan treatment due" items and the plan-step no-show items are gone (they are tasks now; today's diary no-shows stay), replaced by the aggregate after `syncRuleTasks`. Production drops the step-appointments query it no longer needs; the two `plan-step-copy` imports went with it.
- `attention-list.tsx`: kind `tasks` in `KIND_ORDER` (where `treatment_due` sat) with chip "Tasks" (`bg-accent-soft text-accent-ink`) and the accent rail.

### pt-p7-03-record-panel

- `src/components/retention/patient-tasks-panel.tsx` (new) replaces `recall-tasks-panel.tsx` (deleted) on the record's Treatments tab: "Tasks · N open · done on the Tasks page", `Assign task` (the P4 dialog, pre-filled with the patient and their practitioner), `Open Tasks`, one line per open task (type pill, title, assignee avatar, due; each opens `/tasks?task=`), a collapsed "Recently closed" list. `id="tasks"` with an `id="recall"` alias so the old `#recall` deep links still land. `data-qc="patient-tasks"` (`data-open`), rows `patient-task` (`data-status`). The record no longer builds the paperwork / treatment-due "extra items" for the card.
- One WebKit finding on the way: a `truncate` (nowrap) title inside the row pushed the whole record 157 px wide on iPhone SE; the title is `line-clamp-1 break-words` instead.

### pt-p7-04-noshow-retention-rewire

- `no-show-followup-dialog.tsx`: "Add follow-up task" now calls `createTask` with `type: "rebook_no_show"`, title "Rebook missed <treatment>", the note and the chosen due date; the suggested assignee rule sends it to the front-desk pool.
- `staff-task-hovercard.tsx` (retention's "assign as a task"): one `recall` task per teammate picked, via `createTask`; invalidates the task queries.
- Removed: the six recall handlers in both function files, their POLICY rows, the `nonManagerOwnAssignments` scope rule (no handler used it any more) and its unit test case, the five recall zod schemas, `use-recall-tasks-sync.ts`. `recall_tasks` stays classified in `CLINIC_SCOPED_TABLES` because the table still exists. `check:policy` ok — **191 handlers**.

### pt-p7-05-verify-commit

- `e2e/patients.spec.ts`: the record-agreement test reads `patient-tasks` (`data-open` = the pill count, and as many open `patient-task` rows); the five "attention treatment due" tests become "attention needed aggregates tasks" (owner: the Tasks chip, no `treatment_due` chip, the overdue count on the aggregate equals the Tasks page's Overdue group, the row links to `/tasks`), the mismatch and no-show tests start from the board's pills (the no-show one checks the record's tasks card and that the Tasks page has one rebook and no chase for that patient), and the practitioner / front-desk scope tests check the aggregate, the summary stats and their Tasks page (front desk: no question chip, no question rows).
- `e2e/feedback-corrections.spec.ts:135`: the "My tasks" part reads the aggregate card (open > 0, type chips, team load, no buttons, `Open Tasks` → `/tasks`).

| Check | Result |
| ----- | ------ |
| Probe (`/tmp/pt-dash-crop.mjs`) | owner / practitioner / front desk: two `tasks` attention rows, zero `treatment_due`, subtitles "9 rebooks, 5 chases, 4 questions, 1 recall · past their due time" etc. |
| `e2e/patients.spec.ts` | 17 / 18 (pre-existing insights failure only); `feedback-corrections:135` passes |
| Responsive gate `dashboard` + `patient-record`, 7 devices | **56 / 56** after the phone overflow fix |
| Unit | 242 passed, the 11 pre-existing failures (one test removed with the scope rule) |
| Guards | policy 191 · validators 2 pre-existing · tenancy 62 |
| tsc | 106 (baseline 109; 0 new) |
| Lint | new files 0; touched files no new messages (`schemas.ts` 4 → 4, `policy.ts` 1 → 1, `no-show-followup-dialog.tsx` 12 → 10, `permissions.ts` 27 → 26, `access-catalogue.ts` 41 → 40) |
| Commit | see the index |
