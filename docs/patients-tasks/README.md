# Patients (Records + Journey board) and Tasks redesign: index

Plan: `.cursor/plans/patients_&_tasks_redesign_c3b69b00.plan.md`. Branch `e2e_exp`, cut from `e2e_live` at `ff89a40`. Design hand-off: `Claude outputs/design_handoff_patients_tasks/` (README, `types.ts`, `data-model.sql`, six screenshots, interactive prototype).

Rule of the redesign: **the Patients page is for seeing, the Tasks page is for doing.** Structure, layout, components and behaviour come from the mockups; colours, type, radii, shadows and control idioms stay the app's own (the only palette addition is the `--noshow` family).

Every phase has a worklog with one `### <todo-id>` section per to-do (files changed, what and why, how it was checked) and a phase summary (verification table, commit). Captures under `captures/before/` (P0) and `captures/after/` (P8) share file names so the regression proof is side by side; per-phase captures live under `captures/pN-*/`.

## Phases

| Phase | Worklog | Scope | Commit |
| ----- | ------- | ----- | ------ |
| P0 | [`worklog/00-baseline.md`](worklog/00-baseline.md) | Branch, docs scaffold, baselines, before-captures | `0bd63f3` |
| P1 | [`worklog/01-foundations.md`](worklog/01-foundations.md) | Pure helpers: task types, records summary, board risk, staff lanes, urgent triage, `--noshow` tokens | |
| P2 | [`worklog/02-schema.md`](worklog/02-schema.md) | `tasks`, `task_events`, `automation_rules` schema, types, tenancy, demo fixtures | |
| P3 | [`worklog/03-server.md`](worklog/03-server.md) | Rule evaluator, sync, task handlers, patient summaries, RBAC, notifications, realtime | |
| P4 | [`worklog/04-records.md`](worklog/04-records.md) | Patients → Records (A) and the Assign dialog (D) | |
| P5 | [`worklog/05-journey-board.md`](worklog/05-journey-board.md) | Patients → Journey board (B) | |
| P6 | [`worklog/06-tasks-page.md`](worklog/06-tasks-page.md) | Tasks page (C) and the sidebar item | |
| P7 | [`worklog/07-dashboard-rewire.md`](worklog/07-dashboard-rewire.md) | Dashboard aggregation; rewiring the old recall surfaces | |
| P8 | [`worklog/08-tests-and-verify.md`](worklog/08-tests-and-verify.md) | e2e, device matrix, full verification, after-captures, docs | |

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
| `pt-p2-01-migration` | P2 | `20261003000100_tasks.sql` | pending | |
| `pt-p2-02-types-scope` | P2 | `types.ts` rows, `CLINIC_SCOPED_TABLES` | pending | |
| `pt-p2-03-demo-fixtures` | P2 | demo `automationRules`, `tasks`, `taskEvents`; recall rows converted | pending | |
| `pt-p2-04-verify-commit` | P2 | guards, unit, tsc/lint; commit | pending | |
| `pt-p3-01-evaluator` | P3 | `src/lib/tasks/evaluate-rules.ts` + unit tests | pending | |
| `pt-p3-02-sync-rule-tasks` | P3 | `syncRuleTasks` prod + demo | pending | |
| `pt-p3-03-list-and-summary` | P3 | `listTasks`, `getTasksSummary` | pending | |
| `pt-p3-04-write-handlers` | P3 | create / assign / hand-off / claim / attempt / complete / escalate / snooze / undo | pending | |
| `pt-p3-05-patient-summaries` | P3 | `listPatientSummaries`, `listPatientTasks`, plan risk fields | pending | |
| `pt-p3-06-recall-adapters` | P3 | recall handlers as adapters over tasks | pending | |
| `pt-p3-07-rbac-policy-schemas` | P3 | permission keys, policy rows, schemas, catalogue node | pending | |
| `pt-p3-08-notify-realtime` | P3 | notifications, `use-tasks-sync` | pending | |
| `pt-p3-09-verify-commit` | P3 | persona probes, unit, guards; commit | pending | |
| `pt-p4-01-extract-records-tab` | P4 | `records-tab.tsx` extracted from the route | pending | |
| `pt-p4-02-filter-bar` | P4 | `records-filter-bar.tsx` | pending | |
| `pt-p4-03-records-table` | P4 | `records-table.tsx` | pending | |
| `pt-p4-04-patient-drawer` | P4 | `patient-drawer.tsx` | pending | |
| `pt-p4-05-assign-dialog` | P4 | `tasks/assign-task-dialog.tsx` | pending | |
| `pt-p4-06-drawer-actions` | P4 | drawer actions wired | pending | |
| `pt-p4-07-verify-commit` | P4 | specs, responsive gate, captures; commit | pending | |
| `pt-p5-01-board-filters-tiles` | P5 | faces + six triage tiles, URL state | pending | |
| `pt-p5-02-board-map` | P5 | practitioner × phase map | pending | |
| `pt-p5-03-board-responsive` | P5 | narrow layouts | pending | |
| `pt-p5-04-verify-commit` | P5 | specs, responsive gate, captures; commit | pending | |
| `pt-p6-01-route-nav` | P6 | `/tasks` route + `tasks-nav` | pending | |
| `pt-p6-02-task-list-row` | P6 | `task-list`, `task-row` | pending | |
| `pt-p6-03-delegate-outcome-panels` | P6 | `delegate-panel`, `outcome-panel` | pending | |
| `pt-p6-04-bulk-dnd` | P6 | `bulk-bar`, drag to assign | pending | |
| `pt-p6-05-right-rails` | P6 | `team-panel`, `your-day-panel`, `todays-calls-panel` | pending | |
| `pt-p6-06-optimistic-undo-toast` | P6 | optimistic mutations, Undo toast | pending | |
| `pt-p6-07-sidebar-badge` | P6 | Tasks nav item with open-count badge | pending | |
| `pt-p6-08-tasks-responsive` | P6 | narrow layouts | pending | |
| `pt-p6-09-verify-commit` | P6 | role probes, responsive gate, captures; commit | pending | |
| `pt-p7-01-dashboard-summary-card` | P7 | `tasks-summary-card.tsx` replaces Follow-up tasks | pending | |
| `pt-p7-02-attention-aggregate` | P7 | aggregated `tasks` attention items | pending | |
| `pt-p7-03-record-panel` | P7 | `patient-tasks-panel.tsx` on the record | pending | |
| `pt-p7-04-noshow-retention-rewire` | P7 | no-show dialog, retention send, hovercard on tasks; adapters removed | pending | |
| `pt-p7-05-verify-commit` | P7 | specs, responsive gate, captures; commit | pending | |
| `pt-p8-01-e2e-tasks` | P8 | `e2e/tasks.spec.ts` | pending | |
| `pt-p8-02-e2e-patients` | P8 | `e2e/patients-records.spec.ts`, `e2e/journey-board.spec.ts` | pending | |
| `pt-p8-03-e2e-updates` | P8 | touched specs, responsive pages | pending | |
| `pt-p8-04-unit-guards` | P8 | unit suites, guards | pending | |
| `pt-p8-05-device-matrix` | P8 | responsive gate on 7 projects | pending | |
| `pt-p8-06-full-verify` | P8 | full Chromium e2e, unit, tsc, lint, gateway smoke | pending | |
| `pt-p8-07-after-captures` | P8 | after-captures + side-by-side table | pending | |
| `pt-p8-08-docs-commit` | P8 | finish this index; commit | pending | |

## Device matrix

Playwright projects from `playwright.responsive.config.ts`. Focus devices for captures: `laptop-1440` (Chromium, 1440×900), `ipad-pro-landscape` (WebKit, iPad Pro 11 landscape) and `ipad-mini-portrait` (WebKit, iPad Mini portrait). The gate runs on all seven (`iphone-se`, `iphone-15`, `ipad-mini-portrait`, `ipad-pro-landscape`, `laptop-1366`, `laptop-1440`, `desktop-1920`).

## Regression proof

Filled in at P8: `captures/before/` (P0) beside `captures/after/` (P8), same file names.
