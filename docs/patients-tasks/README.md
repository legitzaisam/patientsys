# Patients (Records + Journey board) and Tasks redesign: index

Plan: `.cursor/plans/patients_&_tasks_redesign_c3b69b00.plan.md`. Branch `e2e_exp`, cut from `e2e_live` at `ff89a40`. Design hand-off: `Claude outputs/design_handoff_patients_tasks/` (README, `types.ts`, `data-model.sql`, six screenshots, interactive prototype).

Rule of the redesign: **the Patients page is for seeing, the Tasks page is for doing.** Structure, layout, components and behaviour come from the mockups; colours, type, radii, shadows and control idioms stay the app's own (the only palette addition is the `--noshow` family).

Every phase has a worklog with one `### <todo-id>` section per to-do (files changed, what and why, how it was checked) and a phase summary (verification table, commit). Captures under `captures/before/` (P0) and `captures/after/` (P8) share file names so the regression proof is side by side; per-phase captures live under `captures/pN-*/`.

## Phases

| Phase | Worklog | Scope | Commit |
| ----- | ------- | ----- | ------ |
| P0 | [`worklog/00-baseline.md`](worklog/00-baseline.md) | Branch, docs scaffold, baselines, before-captures | `0bd63f3` |
| P1 | [`worklog/01-foundations.md`](worklog/01-foundations.md) | Pure helpers: task types, records summary, board risk, staff lanes, urgent triage, `--noshow` tokens | `9fb4213` |
| P2 | [`worklog/02-schema.md`](worklog/02-schema.md) | `tasks`, `task_events`, `automation_rules` schema, types, tenancy, demo fixtures | `e0987c5` |
| P3 | [`worklog/03-server.md`](worklog/03-server.md) | Rule evaluator, sync, task handlers, patient summaries, RBAC, notifications, realtime | `eb79eba` |
| P4 | [`worklog/04-records.md`](worklog/04-records.md) | Patients → Records (A) and the Assign dialog (D) | `5c366d2` |
| P5 | [`worklog/05-journey-board.md`](worklog/05-journey-board.md) | Patients → Journey board (B) | `7f760b7` |
| P6 | [`worklog/06-tasks-page.md`](worklog/06-tasks-page.md) | Tasks page (C) and the sidebar item | `192844e` |
| P7 | [`worklog/07-dashboard-rewire.md`](worklog/07-dashboard-rewire.md) | Dashboard aggregation; rewiring the old recall surfaces | `8949cf7` |
| P8 | [`worklog/08-tests-and-verify.md`](worklog/08-tests-and-verify.md) | e2e, device matrix, full verification, after-captures, docs | `d9b66fc` (+ this hash note) |
| QC | [`worklog/09-tasks-qc.md`](worklog/09-tasks-qc.md) | Tasks page review: demo Viewing as pill, ten-a-page pagination, nav label wrap, alignment audit | `42f1bc1` |

## To-dos

| Id | Phase | What | Status | Worklog |
| -- | ----- | ---- | ------ | ------- |
| `pt-p0-01-branch` | P0 | `git checkout -b e2e_exp` from `e2e_live` (`ff89a40`); clean tree | done | [`00-baseline.md#pt-p0-01-branch`](worklog/00-baseline.md#pt-p0-01-branch) |
| `pt-p0-02-docs-scaffold` | P0 | this index, worklog/00, captures dirs | done | [`00-baseline.md#pt-p0-02-docs-scaffold`](worklog/00-baseline.md#pt-p0-02-docs-scaffold) |
| `pt-p0-03-baselines` | P0 | tsc, unit, guards, responsive gate, pre-existing Chromium e2e failures, lint per file to be touched | done | [`00-baseline.md#pt-p0-03-baselines`](worklog/00-baseline.md#pt-p0-03-baselines) |
| `pt-p0-04-before-captures` | P0 | before-captures on laptop-1440 (Chromium), ipad-pro-landscape and ipad-mini-portrait (WebKit) | done | [`00-baseline.md#pt-p0-04-before-captures`](worklog/00-baseline.md#pt-p0-04-before-captures) |
| `pt-p0-05-commit` | P0 | commit docs scaffold and before-captures | done | [`00-baseline.md#pt-p0-05-commit`](worklog/00-baseline.md#pt-p0-05-commit) |
| `pt-p1-01-task-types` | P1 | `src/lib/tasks/types.ts` + unit tests | done | [`01-foundations.md#pt-p1-01-task-types`](worklog/01-foundations.md#pt-p1-01-task-types) |
| `pt-p1-02-records-summary` | P1 | `src/lib/patients/records-summary.ts` + unit tests | done | [`01-foundations.md#pt-p1-02-records-summary`](worklog/01-foundations.md#pt-p1-02-records-summary) |
| `pt-p1-03-board-risk` | P1 | `src/lib/patients/board-risk.ts` + unit tests | done | [`01-foundations.md#pt-p1-03-board-risk`](worklog/01-foundations.md#pt-p1-03-board-risk) |
| `pt-p1-04-staff-lane-triage` | P1 | `src/lib/staff-lane.ts`, `src/lib/tasks/urgent-triage.ts` + unit tests | done | [`01-foundations.md#pt-p1-04-staff-lane-triage`](worklog/01-foundations.md#pt-p1-04-staff-lane-triage) |
| `pt-p1-05-noshow-tokens` | P1 | `--noshow` token family in `styles.css` | done | [`01-foundations.md#pt-p1-05-noshow-tokens`](worklog/01-foundations.md#pt-p1-05-noshow-tokens) |
| `pt-p1-06-verify-commit` | P1 | unit, tsc/lint; commit | done | [`01-foundations.md#pt-p1-06-verify-commit`](worklog/01-foundations.md#pt-p1-06-verify-commit) |
| `pt-p2-01-migration` | P2 | `20261003000100_tasks.sql` | done | [`02-schema.md#pt-p2-01-migration`](worklog/02-schema.md#pt-p2-01-migration) |
| `pt-p2-02-types-scope` | P2 | `types.ts` rows, `CLINIC_SCOPED_TABLES` | done | [`02-schema.md#pt-p2-02-types-scope`](worklog/02-schema.md#pt-p2-02-types-scope) |
| `pt-p2-03-demo-fixtures` | P2 | demo `automationRules`, `tasks`, `taskEvents`; recall rows converted | done | [`02-schema.md#pt-p2-03-demo-fixtures`](worklog/02-schema.md#pt-p2-03-demo-fixtures) |
| `pt-p2-04-verify-commit` | P2 | guards, unit, tsc/lint; commit | done | [`02-schema.md#pt-p2-04-verify-commit`](worklog/02-schema.md#pt-p2-04-verify-commit) |
| `pt-p3-01-evaluator` | P3 | `src/lib/tasks/evaluate-rules.ts` + unit tests | done | [`03-server.md#pt-p3-01-evaluator`](worklog/03-server.md#pt-p3-01-evaluator) |
| `pt-p3-02-sync-rule-tasks` | P3 | `syncRuleTasks` prod + demo | done | [`03-server.md#pt-p3-02-sync-rule-tasks`](worklog/03-server.md#pt-p3-02-sync-rule-tasks) |
| `pt-p3-03-list-and-summary` | P3 | `listTasks`, `getTasksSummary` | done | [`03-server.md#pt-p3-03-list-and-summary`](worklog/03-server.md#pt-p3-03-list-and-summary) |
| `pt-p3-04-write-handlers` | P3 | create / assign / hand-off / claim / attempt / complete / escalate / snooze / undo | done | [`03-server.md#pt-p3-04-write-handlers`](worklog/03-server.md#pt-p3-04-write-handlers) |
| `pt-p3-05-patient-summaries` | P3 | `listPatientSummaries`, `listPatientTasks`, plan risk fields | done | [`03-server.md#pt-p3-05-patient-summaries`](worklog/03-server.md#pt-p3-05-patient-summaries) |
| `pt-p3-06-recall-adapters` | P3 | recall handlers as adapters over tasks | done | [`03-server.md#pt-p3-06-recall-adapters`](worklog/03-server.md#pt-p3-06-recall-adapters) |
| `pt-p3-07-rbac-policy-schemas` | P3 | permission keys, policy rows, schemas, catalogue node | done | [`03-server.md#pt-p3-07-rbac-policy-schemas`](worklog/03-server.md#pt-p3-07-rbac-policy-schemas) |
| `pt-p3-08-notify-realtime` | P3 | notifications, `use-tasks-sync` | done | [`03-server.md#pt-p3-08-notify-realtime`](worklog/03-server.md#pt-p3-08-notify-realtime) |
| `pt-p3-09-verify-commit` | P3 | persona probes, unit, guards; commit | done | [`03-server.md#pt-p3-09-verify-commit`](worklog/03-server.md#pt-p3-09-verify-commit) |
| `pt-p4-01-extract-records-tab` | P4 | `records-tab.tsx` extracted from the route | done | [`04-records.md#pt-p4-01-extract-records-tab`](worklog/04-records.md#pt-p4-01-extract-records-tab) |
| `pt-p4-02-filter-bar` | P4 | `records-filter-bar.tsx` | done | [`04-records.md#pt-p4-02-filter-bar`](worklog/04-records.md#pt-p4-02-filter-bar) |
| `pt-p4-03-records-table` | P4 | `records-table.tsx` | done | [`04-records.md#pt-p4-03-records-table`](worklog/04-records.md#pt-p4-03-records-table) |
| `pt-p4-04-patient-drawer` | P4 | `patient-drawer.tsx` | done | [`04-records.md#pt-p4-04-patient-drawer`](worklog/04-records.md#pt-p4-04-patient-drawer) |
| `pt-p4-05-assign-dialog` | P4 | `tasks/assign-task-dialog.tsx` | done | [`04-records.md#pt-p4-05-assign-dialog`](worklog/04-records.md#pt-p4-05-assign-dialog) |
| `pt-p4-06-drawer-actions` | P4 | drawer actions wired | done | [`04-records.md#pt-p4-06-drawer-actions`](worklog/04-records.md#pt-p4-06-drawer-actions) |
| `pt-p4-07-verify-commit` | P4 | specs, responsive gate, captures; commit | done | [`04-records.md#pt-p4-07-verify-commit`](worklog/04-records.md#pt-p4-07-verify-commit) |
| `pt-p5-01-board-filters-tiles` | P5 | faces + six triage tiles, URL state | done | [`05-journey-board.md#pt-p5-01-board-filters-tiles`](worklog/05-journey-board.md#pt-p5-01-board-filters-tiles) |
| `pt-p5-02-board-map` | P5 | practitioner × phase map | done | [`05-journey-board.md#pt-p5-02-board-map`](worklog/05-journey-board.md#pt-p5-02-board-map) |
| `pt-p5-03-board-responsive` | P5 | narrow layouts | done | [`05-journey-board.md#pt-p5-03-board-responsive`](worklog/05-journey-board.md#pt-p5-03-board-responsive) |
| `pt-p5-04-verify-commit` | P5 | specs, responsive gate, captures; commit | done | [`05-journey-board.md#pt-p5-04-verify-commit`](worklog/05-journey-board.md#pt-p5-04-verify-commit) |
| `pt-p6-01-route-nav` | P6 | `/tasks` route + `tasks-nav` | done | [`06-tasks-page.md#pt-p6-01-route-nav`](worklog/06-tasks-page.md#pt-p6-01-route-nav) |
| `pt-p6-02-task-list-row` | P6 | `task-list`, `task-row` | done | [`06-tasks-page.md#pt-p6-02-task-list-row`](worklog/06-tasks-page.md#pt-p6-02-task-list-row) |
| `pt-p6-03-delegate-outcome-panels` | P6 | `delegate-panel`, `outcome-panel` | done | [`06-tasks-page.md#pt-p6-03-delegate-outcome-panels`](worklog/06-tasks-page.md#pt-p6-03-delegate-outcome-panels) |
| `pt-p6-04-bulk-dnd` | P6 | `bulk-bar`, drag to assign | done | [`06-tasks-page.md#pt-p6-04-bulk-dnd`](worklog/06-tasks-page.md#pt-p6-04-bulk-dnd) |
| `pt-p6-05-right-rails` | P6 | `team-panel`, `your-day-panel`, `todays-calls-panel` | done | [`06-tasks-page.md#pt-p6-05-right-rails`](worklog/06-tasks-page.md#pt-p6-05-right-rails) |
| `pt-p6-06-optimistic-undo-toast` | P6 | optimistic mutations, Undo toast | done | [`06-tasks-page.md#pt-p6-06-optimistic-undo-toast`](worklog/06-tasks-page.md#pt-p6-06-optimistic-undo-toast) |
| `pt-p6-07-sidebar-badge` | P6 | Tasks nav item with open-count badge | done | [`06-tasks-page.md#pt-p6-07-sidebar-badge`](worklog/06-tasks-page.md#pt-p6-07-sidebar-badge) |
| `pt-p6-08-tasks-responsive` | P6 | narrow layouts | done | [`06-tasks-page.md#pt-p6-08-tasks-responsive`](worklog/06-tasks-page.md#pt-p6-08-tasks-responsive) |
| `pt-p6-09-verify-commit` | P6 | role probes, responsive gate, captures; commit | done | [`06-tasks-page.md#pt-p6-09-verify-commit`](worklog/06-tasks-page.md#pt-p6-09-verify-commit) |
| `pt-p7-01-dashboard-summary-card` | P7 | `tasks-summary-card.tsx` replaces Follow-up tasks | done | [`07-dashboard-rewire.md#pt-p7-01-dashboard-summary-card`](worklog/07-dashboard-rewire.md#pt-p7-01-dashboard-summary-card) |
| `pt-p7-02-attention-aggregate` | P7 | aggregated `tasks` attention items | done | [`07-dashboard-rewire.md#pt-p7-02-attention-aggregate`](worklog/07-dashboard-rewire.md#pt-p7-02-attention-aggregate) |
| `pt-p7-03-record-panel` | P7 | `patient-tasks-panel.tsx` on the record | done | [`07-dashboard-rewire.md#pt-p7-03-record-panel`](worklog/07-dashboard-rewire.md#pt-p7-03-record-panel) |
| `pt-p7-04-noshow-retention-rewire` | P7 | no-show dialog, retention send, hovercard on tasks; adapters removed | done | [`07-dashboard-rewire.md#pt-p7-04-noshow-retention-rewire`](worklog/07-dashboard-rewire.md#pt-p7-04-noshow-retention-rewire) |
| `pt-p7-05-verify-commit` | P7 | specs, responsive gate, captures; commit | done | [`07-dashboard-rewire.md#pt-p7-05-verify-commit`](worklog/07-dashboard-rewire.md#pt-p7-05-verify-commit) |
| `pt-p8-01-e2e-tasks` | P8 | `e2e/tasks.spec.ts` (7 tests, three roles); same-pass escalation | done | [`08-tests-and-verify.md#pt-p8-01-e2e-tasks`](worklog/08-tests-and-verify.md#pt-p8-01-e2e-tasks) |
| `pt-p8-02-e2e-patients` | P8 | `e2e/patients-records.spec.ts` (9), `e2e/journey-board.spec.ts` (4); `prac=all` fix | done | [`08-tests-and-verify.md#pt-p8-02-e2e-patients`](worklog/08-tests-and-verify.md#pt-p8-02-e2e-patients) |
| `pt-p8-03-e2e-updates` | P8 | retention, offers, capture selectors, responsive pages | done | [`08-tests-and-verify.md#pt-p8-03-e2e-updates`](worklog/08-tests-and-verify.md#pt-p8-03-e2e-updates) |
| `pt-p8-04-unit-guards` | P8 | unit 243 (+11 pre-existing), guards, metrics | done | [`08-tests-and-verify.md#pt-p8-04-unit-guards`](worklog/08-tests-and-verify.md#pt-p8-04-unit-guards) |
| `pt-p8-05-device-matrix` | P8 | responsive gate 126 / 126 on 7 projects | done | [`08-tests-and-verify.md#pt-p8-05-device-matrix`](worklog/08-tests-and-verify.md#pt-p8-05-device-matrix) |
| `pt-p8-06-full-verify` | P8 | full Chromium e2e, tsc, lint, gateway smoke | done | [`08-tests-and-verify.md#pt-p8-06-full-verify`](worklog/08-tests-and-verify.md#pt-p8-06-full-verify) |
| `pt-p8-07-after-captures` | P8 | 33 after-captures + side-by-side table | done | [`08-tests-and-verify.md#pt-p8-07-after-captures`](worklog/08-tests-and-verify.md#pt-p8-07-after-captures) |
| `pt-p8-08-docs-commit` | P8 | this index, worklog/08; commit | done | [`08-tests-and-verify.md#pt-p8-08-docs-commit`](worklog/08-tests-and-verify.md#pt-p8-08-docs-commit) |

## Device matrix

Playwright projects from `playwright.responsive.config.ts`. Focus devices for captures: `laptop-1440` (Chromium, 1440×900), `ipad-pro-landscape` (WebKit, iPad Pro 11 landscape) and `ipad-mini-portrait` (WebKit, iPad Mini portrait). The gate runs on all seven (`iphone-se`, `iphone-15`, `ipad-mini-portrait`, `ipad-pro-landscape`, `laptop-1366`, `laptop-1440`, `desktop-1920`).

Final run (P8, `RESPONSIVE_GATE=major`, every state of every entry): **126 / 126**. Cells are passes / role runs.

| Entry | Roles | iphone-se | iphone-15 | ipad-mini-portrait | ipad-pro-landscape | laptop-1366 | laptop-1440 | desktop-1920 |
| ----- | ----- | --------- | --------- | ------------------ | ------------------ | ----------- | ----------- | ------------ |
| `patients` (Records: drawer, Select, Assign dialog) | owner, practitioner, front desk, admin | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| `patients-board` (tiles lit) | owner, practitioner | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| `tasks` (delegate panel, bulk select) | owner, manager | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| `tasks-practitioner` (outcome panel) | practitioner | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| `tasks-front-desk` (outcome panel) | front desk | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| `dashboard` (Tasks summary card, Attention) | owner, practitioner, front desk, admin | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| `patient-record` (Tasks panel) | owner, practitioner, front desk, admin | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |

## Regression proof

`captures/before/` (P0, `0bd63f3`) beside `captures/after/` (P8), same file names, same devices, same personas, fresh demo server each time. The three `tasks-*` scenes have no "before": the page is new.

| Scene | Persona | Before → after | laptop-1440 | ipad-landscape | ipad-portrait |
| ----- | ------- | -------------- | ----------- | -------------- | ------------- |
| Records | owner | filter chips + status column → practitioner chips, Select, drawer with suggestion, plan bar, open tasks | [before](captures/before/records-owner--laptop-1440.jpg) · [after](captures/after/records-owner--laptop-1440.jpg) | [before](captures/before/records-owner--ipad-landscape.jpg) · [after](captures/after/records-owner--ipad-landscape.jpg) | [before](captures/before/records-owner--ipad-portrait.jpg) · [after](captures/after/records-owner--ipad-portrait.jpg) |
| Records | practitioner | whole list → own book by default, "Show everyone" | [before](captures/before/records-practitioner--laptop-1440.jpg) · [after](captures/after/records-practitioner--laptop-1440.jpg) | [before](captures/before/records-practitioner--ipad-landscape.jpg) · [after](captures/after/records-practitioner--ipad-landscape.jpg) | [before](captures/before/records-practitioner--ipad-portrait.jpg) · [after](captures/after/records-practitioner--ipad-portrait.jpg) |
| Journey board | owner | cards with Book buttons → six triage tiles over the practitioner × phase map, pills open the drawer | [before](captures/before/board-owner--laptop-1440.jpg) · [after](captures/after/board-owner--laptop-1440.jpg) | [before](captures/before/board-owner--ipad-landscape.jpg) · [after](captures/after/board-owner--ipad-landscape.jpg) | [before](captures/before/board-owner--ipad-portrait.jpg) · [after](captures/after/board-owner--ipad-portrait.jpg) |
| Dashboard | owner | Follow-up tasks list → Tasks summary card; Attention "Tasks" aggregates | [before](captures/before/dashboard-owner--laptop-1440.jpg) · [after](captures/after/dashboard-owner--laptop-1440.jpg) | [before](captures/before/dashboard-owner--ipad-landscape.jpg) · [after](captures/after/dashboard-owner--ipad-landscape.jpg) | [before](captures/before/dashboard-owner--ipad-portrait.jpg) · [after](captures/after/dashboard-owner--ipad-portrait.jpg) |
| Dashboard | practitioner | as above, own tasks only | [before](captures/before/dashboard-practitioner--laptop-1440.jpg) · [after](captures/after/dashboard-practitioner--laptop-1440.jpg) | [before](captures/before/dashboard-practitioner--ipad-landscape.jpg) · [after](captures/after/dashboard-practitioner--ipad-landscape.jpg) | [before](captures/before/dashboard-practitioner--ipad-portrait.jpg) · [after](captures/after/dashboard-practitioner--ipad-portrait.jpg) |
| Dashboard | front desk | as above, queue + pool, no clinical questions | [before](captures/before/dashboard-front-desk--laptop-1440.jpg) · [after](captures/after/dashboard-front-desk--laptop-1440.jpg) | [before](captures/before/dashboard-front-desk--ipad-landscape.jpg) · [after](captures/after/dashboard-front-desk--ipad-landscape.jpg) | [before](captures/before/dashboard-front-desk--ipad-portrait.jpg) · [after](captures/after/dashboard-front-desk--ipad-portrait.jpg) |
| Record · Treatments | owner | Recall tasks panel → read-only Tasks panel with Assign task and a link to Tasks | [before](captures/before/record-treatments-owner--laptop-1440.jpg) · [after](captures/after/record-treatments-owner--laptop-1440.jpg) | [before](captures/before/record-treatments-owner--ipad-landscape.jpg) · [after](captures/after/record-treatments-owner--ipad-landscape.jpg) | [before](captures/before/record-treatments-owner--ipad-portrait.jpg) · [after](captures/after/record-treatments-owner--ipad-portrait.jpg) |
| Retention | owner | unchanged page; "Send recall task" now creates tasks | [before](captures/before/retention-owner--laptop-1440.jpg) · [after](captures/after/retention-owner--laptop-1440.jpg) | [before](captures/before/retention-owner--ipad-landscape.jpg) · [after](captures/after/retention-owner--ipad-landscape.jpg) | [before](captures/before/retention-owner--ipad-portrait.jpg) · [after](captures/after/retention-owner--ipad-portrait.jpg) |
| Tasks | owner | new: Whole team, type chips, Team rail | [after](captures/after/tasks-owner--laptop-1440.jpg) | [after](captures/after/tasks-owner--ipad-landscape.jpg) | [after](captures/after/tasks-owner--ipad-portrait.jpg) |
| Tasks | practitioner | new: Assigned to me, Your day rail | [after](captures/after/tasks-practitioner--laptop-1440.jpg) | [after](captures/after/tasks-practitioner--ipad-landscape.jpg) | [after](captures/after/tasks-practitioner--ipad-portrait.jpg) |
| Tasks | front desk | new: My queue, Today's calls rail | [after](captures/after/tasks-front-desk--laptop-1440.jpg) | [after](captures/after/tasks-front-desk--ipad-landscape.jpg) | [after](captures/after/tasks-front-desk--ipad-portrait.jpg) |
