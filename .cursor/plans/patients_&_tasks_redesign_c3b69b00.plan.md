---
name: Patients & Tasks redesign
overview: Rebuild Patients (Records table + drawer, Journey board triage map) and add a role-aware Tasks page with a real `tasks` backend, on a new `e2e_exp` branch, in nine phases from pure helpers to UI to tests, with a worklog entry per to-do and a Playwright device matrix (Chromium 1440, WebKit iPad landscape and portrait) run after every phase.
todos:
  - id: pt-p0-01-branch
    content: "P0: git checkout -b e2e_exp from e2e_live (ff89a40); confirm clean tree; record in worklog/00"
    status: completed
  - id: pt-p0-02-docs-scaffold
    content: "P0: docs/patients-tasks/README.md (phase table, to-do table, worklog links) + worklog/00-baseline.md; captures/before|after dirs"
    status: completed
  - id: pt-p0-03-baselines
    content: "P0: record tsc (109), unit (214+11), guards, responsive gate, the 7 pre-existing Chromium e2e failures, lint per file to be touched"
    status: completed
  - id: pt-p0-04-before-captures
    content: "P0: before-captures on laptop-1440 (Chromium) + ipad-pro-landscape + ipad-mini-portrait (WebKit): records owner/practitioner, board owner, dashboard owner/practitioner/front desk, record Treatments tab, retention"
    status: completed
  - id: pt-p0-05-commit
    content: "P0: commit docs scaffold + before-captures (exact paths); worklog/00 summary"
    status: completed
  - id: pt-p1-01-task-types
    content: "P1: src/lib/tasks/types.ts — enums, TASK_TYPE_META (existing chip classes + noshow), role view lists, dueBucket, taskDueLabel, suggestedAssignee, attempt/escalation constants; unit tests"
    status: completed
  - id: pt-p1-02-records-summary
    content: "P1: src/lib/patients/records-summary.ts — patientType, nextTreatmentState, relativeAgo, suggestedNextStep, planSegments; unit tests"
    status: completed
  - id: pt-p1-03-board-risk
    content: "P1: src/lib/patients/board-risk.ts — boardRisk → RiskKey on planStepState, tileMatches (due_this_week), RISK_META, pillTooltip; unit tests"
    status: completed
  - id: pt-p1-04-staff-lane-triage
    content: "P1: src/lib/staff-lane.ts (lane/initials/short name) + src/lib/tasks/urgent-triage.ts (keyword triage); unit tests"
    status: completed
  - id: pt-p1-05-noshow-tokens
    content: "P1: styles.css --noshow/--noshow-bg/--noshow-ink + @theme inline colours; nothing else in the palette changes"
    status: completed
  - id: pt-p1-06-verify-commit
    content: "P1: unit + tsc/lint deltas; commit; worklog/01 summary"
    status: completed
  - id: pt-p2-01-migration
    content: "P2: migration 20261003000100_tasks.sql — enums, tasks, task_events, automation_rules (+6 seeded rules per clinic), indexes incl. open dedupe unique, RLS, grants, recall_tasks → tasks copy, deprecation comment"
    status: completed
  - id: pt-p2-02-types-scope
    content: "P2: types.ts rows for tasks/task_events/automation_rules; CLINIC_SCOPED_TABLES entries; check:tenancy green"
    status: completed
  - id: pt-p2-03-demo-fixtures
    content: "P2: demo automationRules, tasks, taskEvents; convert recallTasks rows to tasks; manual tasks with notes; two urgent portal questions"
    status: completed
  - id: pt-p2-04-verify-commit
    content: "P2: guards, unit, tsc/lint; commit; worklog/02 summary"
    status: completed
  - id: pt-p3-01-evaluator
    content: "P3: src/lib/tasks/evaluate-rules.ts (pure) — 7 rules + auto-close conditions; unit tests with fixture snapshots"
    status: completed
  - id: pt-p3-02-sync-rule-tasks
    content: "P3: syncRuleTasks(ctx) prod + demo — upsert by dedupe_key, task_events created/auto_closed, per-request throttle"
    status: completed
  - id: pt-p3-03-list-and-summary
    content: "P3: listTasks({view,types?,assigneeId?}) and getTasksSummary() prod + demo, role scoping (questions hidden from front desk)"
    status: completed
  - id: pt-p3-04-write-handlers
    content: "P3: createTask, assignTasks, handOffToPool, claimTask, logAttempt (3rd → owner), completeTask(s), escalateToClinician, snoozeTask, undoTaskEvent — prod + demo, task_events on every write"
    status: completed
  - id: pt-p3-05-patient-summaries
    content: "P3: listPatientSummaries() (Records rows) + listPatientTasks({patient_id}); listTreatmentPlans gains risk + dueBucket; listPatients.openTasks from tasks"
    status: completed
  - id: pt-p3-06-recall-adapters
    content: "P3: existing recall handlers become adapters over tasks (createRecallTask → type=recall, listOpenRecallTasks/listRecallTasks read tasks) so dashboard/record keep working until P7"
    status: completed
  - id: pt-p3-07-rbac-policy-schemas
    content: "P3: permissions.ts keys (view.tasks, tasks.assign_any/handoff/claim/complete) + role packs; policy.ts rows; one-line zod schemas; access-catalogue node tasks; check:policy/check:validators green"
    status: completed
  - id: pt-p3-08-notify-realtime
    content: "P3: task_assigned / task_escalated notifications; src/lib/use-tasks-sync.ts (prod realtime, demo polling) invalidating tasks/tasks-summary/patients/dashboard"
    status: completed
  - id: pt-p3-09-verify-commit
    content: "P3: persona probes for every handler (owner, manager, practitioner, front desk); unit; guards; commit; worklog/03 summary"
    status: completed
  - id: pt-p4-01-extract-records-tab
    content: "P4: move Records out of patients.index.tsx into components/patients/records-tab.tsx; route keeps search schema (+prac, sel), New patient dialog, tab pill"
    status: completed
  - id: pt-p4-02-filter-bar
    content: "P4: records-filter-bar.tsx — Practitioner chips (lane avatar, short name, count, multi, fade), My patients, Show everyone, Select toggle, right summary; drop DOB search"
    status: completed
  - id: pt-p4-03-records-table
    content: "P4: records-table.tsx — Patient (avatar + practitioner badge, type line, inactive), Last, Next (calm/loud rules), Tasks pill; selected-row wash; checkboxes only when Select is on; pagination kept; empty state"
    status: completed
  - id: pt-p4-04-patient-drawer
    content: "P4: patient-drawer.tsx — header, type pill, Suggested next step well + action pills, LAST/NEXT tiles, plan segmented bar, Open tasks + Assign task, Recent activity; follows selection, first-row fallback; Sheet below 1280"
    status: completed
  - id: pt-p4-05-assign-dialog
    content: "P4: components/tasks/assign-task-dialog.tsx (D) — type chips + template, Who radio list with SUGGESTED + workload, Due segmented, three Switch toggles, rule preview, Assign to X → createTask"
    status: completed
  - id: pt-p4-06-drawer-actions
    content: "P4: wire drawer actions — Book (QuickAddAppointment), Send booking link (SendRecallDialog), Call (tel:), Approve offer, Assign task (D), Open task (/tasks?task=)"
    status: completed
  - id: pt-p4-07-verify-commit
    content: "P4: patients.spec list tests updated; responsive gate patients on 7 devices; captures on the 3 focus devices; tsc/lint; commit; worklog/04 summary"
    status: completed
  - id: pt-p5-01-board-filters-tiles
    content: "P5: journey-board.tsx — practitioner faces (multi, ring/fade), six triage tiles (toggle OR, count, descriptor, faces stack, selected fill+ring), URL tiles/prac, ?risk=1 mapping"
    status: completed
  - id: pt-p5-02-board-map
    content: "P5: practitioner × phase map — glass card, even rows, 140px + 4 phase cols, dashed borders, patient pills (avatar, first name, risk dot, tooltip), highlight/fade, legend + note; no Book buttons; pill → records sel"
    status: completed
  - id: pt-p5-03-board-responsive
    content: "P5: <1024 horizontal scroll with sticky practitioner column; tiles 3×2 iPad portrait / 2×3 phone"
    status: completed
  - id: pt-p5-04-verify-commit
    content: "P5: board tests in patients.spec updated; responsive gate patients-board; captures; tsc/lint; commit; worklog/05 summary"
    status: completed
  - id: pt-p6-01-route-nav
    content: "P6: routes/_authenticated/tasks.tsx (search view/types/task) + components/tasks/tasks-nav.tsx (role views with counts, auto-closed footnote)"
    status: completed
  - id: pt-p6-02-task-list-row
    content: "P6: task-list.tsx (Overdue/Today/Later groups) + task-row.tsx (checkbox owner-only, avatar, title, context, type pill + mono source, note well, owner line, attempt tracker, action row, assignee avatar ?/FD, due, done/undo state)"
    status: completed
  - id: pt-p6-03-delegate-outcome-panels
    content: "P6: delegate-panel.tsx (teammate tiles with SUGGESTED + load, due segmented, note, lands-in line, Assign to X) + outcome-panel.tsx (practitioner and front-desk chip sets)"
    status: completed
  - id: pt-p6-04-bulk-dnd
    content: "P6: bulk-bar.tsx (N selected, Mark handled, Clear) + native DnD rows → Team drop targets with hover ring; select-then-tap alternative"
    status: completed
  - id: pt-p6-05-right-rails
    content: "P6: team-panel.tsx (owner: rows with load/overdue bars, click filters or assigns, pool + unassigned tiles, hint), your-day-panel.tsx (practitioner), todays-calls-panel.tsx (front desk progress + 2×2 stats + tip)"
    status: completed
  - id: pt-p6-06-optimistic-undo-toast
    content: "P6: mutation hooks with optimistic snapshot, sonner toast with Undo (5 s) → undoTaskEvent, rollback on error; realtime/polling via use-tasks-sync"
    status: completed
  - id: pt-p6-07-sidebar-badge
    content: "P6: app-shell NavLink.badge + NavItem badge slot; Tasks item under Patients gated by view.tasks; count from getTasksSummary().openForMe"
    status: completed
  - id: pt-p6-08-tasks-responsive
    content: "P6: ≥1280 three columns; iPad landscape two columns + rail below; portrait/phone nav as horizontal pill scroller, inline panels full width"
    status: completed
  - id: pt-p6-09-verify-commit
    content: "P6: role walk-through probes (owner/manager/practitioner/front desk); responsive gate tasks; captures; tsc/lint; commit; worklog/06 summary"
    status: completed
  - id: pt-p7-01-dashboard-summary-card
    content: "P7: dashboard/tasks-summary-card.tsx replaces FollowUpTasks — read-only aggregate by role, type chips, closed-automatically line, Open Tasks link; dashboard.tsx swap; permission label updated"
    status: completed
  - id: pt-p7-02-attention-aggregate
    content: "P7: getDashboard (prod + demo) emits ≤2 aggregated tasks items and drops per-step treatment_due / plan-step no_show; attention-list.tsx CHIP_META + KIND_ORDER tasks"
    status: completed
  - id: pt-p7-03-record-panel
    content: "P7: retention/patient-tasks-panel.tsx (read-only open tasks + Assign task + link) replaces RecallTasksPanel in patients.$id.tsx; #recall aliases #tasks"
    status: completed
  - id: pt-p7-04-noshow-retention-rewire
    content: "P7: no-show-followup-dialog creates rebook_no_show task; send-recall-dialog + staff-task-hovercard on tasks; remove recall adapters + policy rows; check:policy green"
    status: completed
  - id: pt-p7-05-verify-commit
    content: "P7: dashboard/retention/record specs updated; responsive gate dashboard + patient-record; captures; tsc/lint; commit; worklog/07 summary"
    status: completed
  - id: pt-p8-01-e2e-tasks
    content: "P8: e2e/tasks.spec.ts — owner views/type filter/delegate/bulk/drag alternative/undo; practitioner outcomes + hand-off; front desk claim + 3 attempts escalate; questions hidden from front desk"
    status: completed
  - id: pt-p8-02-e2e-patients
    content: "P8: e2e/patients-records.spec.ts + e2e/journey-board.spec.ts; dashboard aggregate + attention tasks assertions"
    status: completed
  - id: pt-p8-03-e2e-updates
    content: "P8: update patients.spec, retention.spec, profile-governance.spec, changelog/review capture selectors; responsive pages.ts entries and states for patients, patients-board, tasks ×3 roles, dashboard"
    status: completed
  - id: pt-p8-04-unit-guards
    content: "P8: unit suites for evaluator/helpers complete; all guards; check:metrics"
    status: completed
  - id: pt-p8-05-device-matrix
    content: "P8: RESPONSIVE_GATE=major on all 7 projects for patients/patients-board/tasks/dashboard/patient-record; fix findings; record table"
    status: completed
  - id: pt-p8-06-full-verify
    content: "P8: full Chromium e2e (only pre-existing failures), unit, tsc ≤109/0 new, lint delta 0, gateway test.mjs smoke"
    status: completed
  - id: pt-p8-07-after-captures
    content: "P8: after-captures with P0 names on laptop-1440 + ipad-pro-landscape + ipad-mini-portrait; side-by-side table in README"
    status: completed
  - id: pt-p8-08-docs-commit
    content: "P8: README to-do table all done with anchors + commits; worklog/08 summary; commit on e2e_exp; no push unless asked"
    status: completed
isProject: false
---

# Patients (Records + Journey board) and Tasks redesign

Source of truth: [`Claude outputs/design_handoff_patients_tasks/README.md`](Claude%20outputs/design_handoff_patients_tasks/README.md), `types.ts`, `data-model.sql`, the six screenshots, and the prototype logic (`vmR4`, `vmB4`, `boardFor`, `vmT4`, `vmGE`). **Structure, layout, components, behaviour and features come from the mockups; colours, type, radii, shadows and control idioms come from the app as it is** (`Card`, `glass-item`, pill segmented control, `bg-accent` CTA, `shadow-inset-hi` wells, `PatientAvatar`, sonner toasts, no left accent rails, pill controls to the right of the title). The only palette addition is the `--noshow` family (peach), as decided.

## Decisions taken (from your answers)

- Backend: real `tasks` + `task_events` tables plus a seeded `automation_rules` table. Rule tasks are created and auto-closed by a pure evaluator that runs server-side when tasks are read (`syncRuleTasks`). No outbox, no cron worker; both can be added later without a schema change.
- Old recall surfaces: `recall_tasks` rows migrate into `tasks` (`type='recall'`). All task actions live on `/tasks`. The dashboard gets an **aggregated, read-only** Tasks summary card in place of "Follow-up tasks", and Attention needed carries at most two aggregated task items ("N tasks overdue" urgent, "N tasks due today" this week) instead of one row per plan step; per-step `treatment_due` and plan-step `no_show` items move into tasks (today's diary no-shows stay). Patient record keeps a read-only "Open tasks" panel with an Assign task button.
- Records keeps search, pagination and New patient; drops DOB search and the status sort column; bulk Send offer sits behind a `Select` toggle in the filter bar.
- Journey board has no action buttons; clicking a pill opens Records with that patient selected in the drawer, where Book / Send booking link / Assign task live. `?risk=1` maps to `tiles=overdue,noshow,nobook`.

Assumptions I am making (say so if any is wrong): team lane colours are assigned deterministically per staff member (order of `listPractitioners` → `--lane-1..8`) via a small `staffLane` helper, since lanes today belong to treatments; urgent portal questions are detected by a keyword triage helper (no new column on `messages`); mono eyebrows use Tailwind `font-mono` (ui-monospace), no new font; on screens narrower than 1280 px the Records drawer becomes a right `Sheet`, and the Tasks right rail moves under the list.

## Data flow

```mermaid
flowchart LR
  plans[treatment_plans + milestones] --> eval
  appts[appointments] --> eval
  msgs[portal messages + photos] --> eval
  offers[patient_offers] --> eval
  rules[automation_rules seeded x6] --> eval
  eval[evaluateRules pure] --> sync[syncRuleTasks upsert by dedupe_key, auto-close]
  sync --> tasks[(tasks + task_events)]
  manual[createTask / assign / claim / attempt / complete] --> tasks
  tasks --> listTasks --> TasksPage[/tasks by role]
  tasks --> summary[getTasksSummary] --> Badge[sidebar badge]
  summary --> DashCard[dashboard Tasks summary card]
  summary --> Attention[Attention needed aggregated items]
  tasks --> patientTasks[listPatientTasks] --> Drawer[Records drawer Open tasks]
  patientTasks --> RecordPanel[patient record Open tasks panel]
```

## Phases (least → most dependent)

Every phase ends with the same gate: unit + guards, the touched e2e specs on Chromium (8091), the responsive gate on the touched pages, tsc (baseline 109, 0 new), lint delta 0 (`python3 /tmp/pf-newlint2.py`), captures on the three focus devices, a worklog summary table, and one commit with the existing author identity (exact paths only; never `.cursor/`, `Claude outputs/`, `.tmp-*`, `launch-plan/.env.local`, `launch-plan/qc/captures/`, `dist/`, `.run/`). No push unless asked.

### P0 · Branch, docs scaffold, baselines, before-captures

First action on approval: `git checkout -b e2e_exp` from `e2e_live` (`ff89a40`). Docs at `docs/patients-tasks/` mirroring `docs/profile-redesign/r2/` (README with phase and to-do tables, `worklog/00-baseline.md`, `captures/before|after`). Baselines: tsc 109, unit 214 + 11 pre-existing failures, the 7 recorded Chromium e2e failures, responsive gate, lint per file to be touched. Before-captures on the focus matrix for: Records (owner, practitioner), Journey board (owner), Dashboard (owner, practitioner, front desk), patient record Treatments tab, Retention.

### P1 · Pure foundations (no UI, no schema)

- `src/lib/tasks/types.ts`: `TaskType`, `TaskStatus`, `TaskSource`, `TaskView`, `TASK_TYPE_META` (label + existing chip classes: chase→warning, recall→sky, question→destructive, offer→accent-soft, support→success, rebook→noshow), role view lists, `dueBucket`, `taskDueLabel` ("2 days late", "3h 22m left", "Thu", "Before 5 Oct"), `suggestedAssignee` (question/support → patient's practitioner, offer → owner, chase/recall/rebook → front desk), attempt/escalation constants (3 misses → owner).
- `src/lib/patients/records-summary.ts`: `patientType` (skin_plan / regular / new), `nextTreatmentState` (booked / due ≤14 d / overdue / later / none with main + sub line), `relativeAgo` ("5 days ago", "5 wks ago", "4 months ago"), `suggestedNextStep` (sentence + up to two actions from state, port of `R2RAW` sug rules), `planSegments`.
- `src/lib/patients/board-risk.ts`: `boardRisk(plan)` → `RiskKey` (noshow → mismatch → overdue → nobook → ontrack) built on `planStepState`; `tileMatches` incl. `due_this_week` = week bucket and nobook; `RISK_META`; `pillTooltip`.
- `src/lib/staff-lane.ts`: lane, initials, short name ("Nadia R.").
- `src/lib/tasks/urgent-triage.ts`: keyword triage for portal questions.
- `styles.css`: `--noshow`, `--noshow-bg`, `--noshow-ink` + `@theme inline` colours (`bg-noshow-bg`, `text-noshow-ink`).
- Unit tests for each helper.

### P2 · Schema, types, tenancy, demo fixtures

- Migration `supabase/migrations/20261003000100_tasks.sql`: enums, `tasks`, `task_events`, `automation_rules` (seed the six handoff rules per existing clinic), indexes incl. the open-only `dedupe_key` unique, RLS per the handoff sketch (managers all; assignee; front-desk pool minus `question`; practitioners their own patients), grants; copy `recall_tasks` → `tasks` (`type='recall'`, `links.recall_task_id`); leave `recall_tasks` in place, commented deprecated (no destructive drop).
- `types.ts` rows; `CLINIC_SCOPED_TABLES` entries; `check:tenancy`.
- Demo: `automationRules` fixture, `tasks`/`taskEvents` arrays; convert the 13 `recallTasks` rows into tasks; add a few manual tasks with notes from Amara and two urgent portal questions on existing threads; rule tasks are produced by the evaluator from the existing plans/appointments (which proves it).

### P3 · Server functions (prod + demo twins), RBAC, realtime

- `src/lib/tasks/evaluate-rules.ts` (pure, unit-tested): snapshot + rules → `{ create[], close[] }` for plan step overdue, step due not booked, urgent portal question, rebook window, no-show, lapsing regular, progress photos; resolve on step booked / replied.
- `syncRuleTasks(ctx)` runs the evaluator and upserts by `dedupe_key`, writing `task_events`; called at the top of `listTasks`, `getTasksSummary`, `listPatientSummaries`.
- New handlers: `listTasks`, `getTasksSummary` (counts per view/type/bucket, team load, pool/unassigned, auto-closed this week, role stats, `openForMe` for the badge), `createTask`, `assignTasks`, `handOffToPool`, `claimTask`, `logAttempt` (3rd → escalate to owner), `completeTask`, `completeTasks`, `escalateToClinician`, `snoozeTask`, `undoTaskEvent`, `listPatientTasks`, `listPatientSummaries` (Records rows: type, primary practitioner, plan progress, last/next, open tasks, activity feed); `listTreatmentPlans` gains `risk` + `dueBucket`.
- Existing recall handlers become thin adapters over `tasks` so nothing breaks before P7; `listPatients.openTasks` reads tasks.
- `permissions.ts` keys `view.tasks`, `tasks.assign_any`, `tasks.handoff`, `tasks.claim`, `tasks.complete` + role packs; `policy.ts` rows; one-line zod schemas; `access-catalogue` node `tasks`; `check:policy` / `check:validators` green.
- Notifications `task_assigned`, `task_escalated` via `notifyStaffMembers`; `src/lib/use-tasks-sync.ts` (prod realtime on `tasks`, demo 5 s polling) invalidating `tasks`, `tasks-summary`, `patients`, `dashboard`.
- Persona probes through `page.evaluate` for every handler.

### P4 · Patients → Records (A) + Assign dialog (D)

- Extract from the 800-line route into `src/components/patients/records-tab.tsx`, `records-filter-bar.tsx` (Practitioner chips with lane avatar + count, `My patients`, `Show everyone`, `Select` toggle, summary), `records-table.tsx` (columns Patient / Last / Next / Tasks, calm-by-default next-treatment, selected row wash), `patient-drawer.tsx` (header, type pill, Suggested next step well, LAST/NEXT tiles, plan bar, Open tasks + Assign task, Recent activity), `src/components/tasks/assign-task-dialog.tsx` (D: type chips + template preview, Who radio list with SUGGESTED, Due segmented, three `Switch` toggles, rule preview).
- URL: `prac` (csv), `sel`, keep `q`, `page`; `view=mine` becomes `prac=me`. Drawer follows selection and falls back to the first visible row.
- Layout `minmax(0,1fr) 380px` ≥1280; drawer as `Sheet` below; table scrolls horizontally on iPad portrait with the Patient column sticky.
- Drawer actions map to existing flows: Book → `QuickAddAppointment`, Send booking link → `SendRecallDialog`, Call → `tel:`, Approve offer → existing offer flow, Assign task → D.

### P5 · Patients → Journey board (B)

Rewrite `journey-board.tsx`: practitioner faces (multi, ring / fade), six triage tiles (toggle, OR, faces stack), practitioner × phase map (glass card, even rows, dashed cell borders, patient pills with risk dot and tooltip), highlight/fade transitions, legend + "Follow-ups live on the Tasks page." Pill click → `/patients?tab=records&sel=<id>`. URL `tiles`, `prac`. Below 1024 the map scrolls horizontally with a sticky practitioner column; tiles wrap 3×2 / 2×3.

### P6 · Tasks page (C) + sidebar

- Route `src/routes/_authenticated/tasks.tsx` (search `view`, `types`, `task`), components under `src/components/tasks/`: `tasks-nav`, `task-list` (Overdue / Today / Later this week), `task-row` (checkbox owner-only, avatar, title, context, type pill + mono source line, note well, owner line, attempt tracker, action row, assignee avatar incl. `?` and `FD`, due), `delegate-panel`, `outcome-panel`, `bulk-bar`, `team-panel` (drop targets, load bars, pool + unassigned tiles), `your-day-panel`, `todays-calls-panel`, `task-toast` (sonner, Undo, 5 s).
- Role behaviour matrix from the README; optimistic updates with snapshot + `undoTaskEvent`; native DnD with the select-then-tap alternative.
- Sidebar: `Tasks` directly under Patients with an open-count badge (`NavLink.badge`, fed by `getTasksSummary().openForMe`).
- Layout `190px 1fr 270px` ≥1280; iPad landscape two columns with the rail below; portrait and phone: nav as a horizontal pill scroller.

### P7 · Dashboard aggregation and rewiring the old surfaces

- `src/components/dashboard/tasks-summary-card.tsx` replaces `FollowUpTasks`: headline "N open · M overdue", type chips with counts, role stats (owner: unassigned / pool / team load bars; practitioner: clinical questions / assigned / patients with others; front desk: queue / pool / retries / handled progress), "N closed automatically this week", `Open Tasks` link. Read-only.
- Attention needed: kind `tasks` (≤2 aggregated items, `CHIP_META`, `KIND_ORDER`); per-step `treatment_due` and plan-step `no_show` items removed from `getDashboard` (prod + demo).
- Patient record: `RecallTasksPanel` → `patient-tasks-panel.tsx` (read-only list + Assign task + link); `#recall` kept as an alias of `#tasks`. No-show dialog and retention send create tasks via `createTask`; `staff-task-hovercard` reads tasks. Remove the recall adapters and their policy rows; `check:policy` green.

### P8 · Tests, device matrix, docs

- New specs: `e2e/tasks.spec.ts` (owner views / type filter / delegate / bulk / drag alternative / undo; practitioner outcomes and hand-off; front desk claim, three attempts escalate; questions hidden from front desk), `e2e/patients-records.spec.ts`, `e2e/journey-board.spec.ts`, dashboard aggregate + attention `tasks` items.
- Update `patients.spec.ts` (board Book → drawer Book; attention treatment due → tasks), `retention.spec.ts`, `profile-governance.spec.ts` if its Attention assertion shifts, changelog/review capture selectors, `e2e/responsive/pages.ts` (patients states `records-drawer`, `records-select`, `assign-dialog`; `patients-board` tiles; `tasks` for owner / practitioner / front_desk with `delegate-open`, `outcome-open`; dashboard).
- Device matrix: gate at `major` on all seven projects for patients, patients-board, tasks, dashboard, patient-record; after-captures with the P0 names on laptop-1440 (Chromium), ipad-pro-landscape and ipad-mini-portrait (WebKit); side-by-side table in the README.
- Full Chromium e2e (only the recorded pre-existing failures), unit, guards, tsc, lint; stitching smoke (`node launch-plan/gateway/test.mjs`) since the gateway is untouched.

## Worklog convention

`docs/patients-tasks/worklog/0N-<phase>.md`, one `### <todo-id>` section per to-do (files, what and why, how checked), a phase summary table (check → result) and the commit hash; README to-do table gets status + anchor as each to-do closes.

## Standing constraints

Commit as `git -c user.name="$(git log -1 --format=%an)" -c user.email="$(git log -1 --format=%ae)" commit …`; no whole-file Prettier on existing files; regression e2e on 8091 (`lsof -ti tcp:8091 | xargs -r kill -9` first), never `lsof … 8090` (kills the gateway); no push unless asked; do not edit the plan file.