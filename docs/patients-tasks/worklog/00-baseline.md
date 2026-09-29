# Phase 0: branch, docs scaffold, baselines, before-captures

Branch `e2e_exp`, cut from `e2e_live` at `ff89a40` (the picker-surface fix). 29 Sep 2026.

### pt-p0-01-branch

- `git checkout -b e2e_exp` from `e2e_live` with a clean tree (no modified tracked files; the untracked `.cursor/plans`, `Claude outputs/`, `.tmp-counts.mjs` stay untracked). HEAD `ff89a40`.
- Everything in this redesign lands on `e2e_exp`; `e2e_live` stays as the last pushed state. No push unless asked.

### pt-p0-02-docs-scaffold

- `docs/patients-tasks/README.md`: phase table (P0–P8), to-do table (all 62 to-dos with status and worklog anchors), device matrix, regression-proof section to be filled at P8.
- `docs/patients-tasks/worklog/00-baseline.md` (this file); `captures/before/` and `captures/after/` directories.
- Convention copied from `docs/profile-redesign/r2/`: one `### <todo-id>` section per to-do, a summary table per phase, the phase commit in the index.

### pt-p0-03-baselines

Recorded at `ff89a40` so every later phase can be compared line-insensitively.

| Check | Baseline |
| ----- | -------- |
| `npx tsc --noEmit -p tsconfig.json` | **109** errors (`/tmp/pt-baseline-tsc.txt`); all pre-existing |
| `check:policy` | ok, 184 handlers |
| `check:validators` | FAILED, pre-existing: `saveAppointment` missing `milestone_id` / unknown `set` (the same two problems recorded in round 1 and round 2) |
| `check:tenancy` | ok, 59 tables (50 clinic-scoped, 9 exempt) |
| `check:metrics` | 16 / 17, the pre-existing `insights-recalc.audit` mismatch |
| Unit (`npx vitest run`) | **214 passed, 11 failed** pre-existing (`earnings` 1, `insights` 4, `period-picker` 5, `policy-scope` 1) |
| Chromium e2e, full | the recorded pre-existing set from round 2 P7 at `83c9669`: `feedback-corrections:61`, `:209`, `:257`, `patients:246`, `reminders:10`, `team-chat-dock:100`, `treatment-workflow:60`; `ff89a40` only touched the two picker primitives |
| Responsive gate (`RESPONSIVE_GATE=major`, 7 projects) on `patients`, `patients-board`, `dashboard`, `patient-record`, `retention` | **112 / 112** (`/tmp/pt-baseline-responsive.txt`, 9.0 min) |

Lint baseline per file to be touched (`python3 /tmp/pf-newlint2.py`, `new-by-line` must stay 0):

| File | Base |
| ---- | ---- |
| `src/routes/_authenticated/patients.index.tsx` | 234 |
| `src/routes/_authenticated/patients.$id.tsx` | 192 |
| `src/routes/_authenticated/dashboard.tsx` | 67 |
| `src/components/patients/journey-board.tsx` | 11 |
| `src/components/patients/plan-step-copy.ts` | 0 |
| `src/components/dashboard/attention-list.tsx` | 3 |
| `src/components/dashboard/follow-up-tasks.tsx` | 103 |
| `src/components/retention/recall-tasks-panel.tsx` | 32 |
| `src/components/retention/staff-task-hovercard.tsx` | 9 |
| `src/components/retention/send-recall-dialog.tsx` | 12 |
| `src/components/no-show-followup-dialog.tsx` | 12 |
| `src/components/app-shell.tsx` | 65 |
| `src/lib/clinic.functions.ts` | 212 |
| `src/lib/clinic.functions.demo.ts` | 110 |
| `src/lib/validation/schemas.ts` | 4 |
| `src/lib/auth/policy.ts` | 1 |
| `src/lib/permissions.ts` | 27 |
| `src/lib/access-catalogue.ts` | 41 |
| `src/lib/demo/data.ts` | 69 |
| `src/lib/auth/clinic-scope.server.ts` | 1 |
| `src/integrations/supabase/types.ts` | 1 |

New files must lint clean (`base 0 now 0`).

### pt-p0-04-before-captures

`node /tmp/pt-captures.mjs http://localhost:8090 docs/patients-tasks/captures/before` against the running demo app (owner / practitioner / front desk personas via the `demo_role` cookie; the demo role switcher and floating dock hidden). Three devices per scene, file name `<scene>--<device>.jpg`:

| Scene | Persona | Path | laptop-1440 (Chromium) | ipad-landscape (WebKit) | ipad-portrait (WebKit) |
| ----- | ------- | ---- | --- | --- | --- |
| `records-owner` | owner | `/patients` | ok | ok | ok |
| `records-practitioner` | practitioner | `/patients` | ok | ok | ok |
| `board-owner` | owner | `/patients?tab=board` | ok | ok | ok |
| `dashboard-owner` | owner | `/dashboard` | ok | ok | ok |
| `dashboard-practitioner` | practitioner | `/dashboard` | ok | ok | ok |
| `dashboard-front-desk` | front desk | `/dashboard` | ok | ok | ok |
| `record-treatments-owner` | owner | `/patients/<olivia>?tab=treatments` | ok | ok | ok |
| `retention-owner` | owner | `/retention` | ok | ok | ok |
| `tasks-*` | all three | `/tasks` | route absent (skipped; captured after P6) | | |

No horizontal overflow on any scene (the script reports `scrollWidth > innerWidth`). The same script with `captures/after` produces the P8 side of the regression proof.

### pt-p0-05-commit

Staged exactly: `docs/patients-tasks/README.md`, `docs/patients-tasks/worklog/00-baseline.md`, `docs/patients-tasks/captures/before/*.jpg` (24 files). Nothing under `.cursor/`, `Claude outputs/` or `.tmp-*`.

## Phase summary

| Check | Result |
| ----- | ------ |
| Branch | `e2e_exp` at `ff89a40`, clean tree |
| tsc | 109 (baseline) |
| Guards | policy ok · validators 2 pre-existing · tenancy ok · metrics 16/17 pre-existing |
| Unit | 214 passed, 11 pre-existing failures |
| Responsive gate, touched pages, 7 devices | 112 / 112 |
| Before-captures | 24 (8 scenes × 3 devices), no overflow |
