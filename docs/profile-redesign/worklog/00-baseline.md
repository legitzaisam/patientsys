# Phase 0: baseline, docs scaffold, before-captures

Branch `e2e_live`, on top of `c291ab1`. 28 Sep 2026.

### p0-01-docs-index

- Created `docs/profile-redesign/README.md` (phase table, to-do table with status and worklog anchor, regression-proof section) and this worklog.
- Checked: both files render as Markdown; the to-do table lists all 60 plan to-dos.

### p0-02-baselines

Recorded on the current tree (`c291ab1` plus another agent's uncommitted `launch-plan/` and demo-handoff files, which are never staged by this plan).

| Check | Baseline |
| ----- | -------- |
| `tsc --noEmit` | 116 errors (`/tmp/pr-baseline-tsc.txt`); every phase compares with `diff <(sort baseline) <(sort now)` and must not add any |
| `check:policy` | ok — 170 handlers |
| `check:validators` | **FAILED, pre-existing**: `saveAppointment` schema is missing `milestone_id` and declares unknown `set` (`clinic.functions.ts:1709`, from the pulled commit `9202460`). Not touched by this plan; the guard must show exactly these two problems and no others |
| `check:tenancy` | ok — 54 tables (45 scoped, 9 exempt) |
| `check:metrics` | **FAILED, pre-existing**: 1 of 17 (`docs/audits/insights-recalc.audit.test.ts` recalculation mismatch, from `58d3dbe`) |
| Unit | 178 passed, **11 failed pre-existing** in 4 files: `permissions.test.ts` (1, "keeps destructive team administration on the owner"), `earnings.test.ts` whatSold (1), `insights.test.ts` (4), `period-picker.test.ts` (5, clinic-time-zone change in the pulled commits) |
| ESLint (files this plan touches) | `/tmp/pr-baseline-lint.txt`: access-control-settings 130, brand-mark 0, earnings-lines-table 36, practitioner-earnings 3, profile-account-tabs 29, security-settings 5, staff-files 25, staff-record-tabs 31, policy 1, clinic.functions.demo 106, clinic.functions 211, dispatch.server 2, demo/data 68, permissions 27, schemas 4, __root 0, profile 18, team.$id 355 |
| Chromium e2e | see below (full run on this tree) |

The four pre-existing failures are the accepted set; the P10 verification requires the same set and nothing more.

| Chromium e2e (full, 7.5 min) | 162 passed, 3 did not run (serial followers), **6 failed pre-existing**: `feedback-corrections:61` (retention picker), `:209` (performance), `:261` (diary pre-read), `patients.spec:246` (insights patient base), `reminders:10`, `treatment-workflow:60`. The retention / performance / insights three broke with the pulled period-picker time-zone change (same root as the 5 unit failures). A seventh failure in that run, `patient-portal/navigation.spec.ts:92` (brand link named /Aetheria/), was caused by Phase 1's wordmark already being on the working tree and is fixed in P1. |

### p0-03-before-captures

- `captures/before/*.jpg` (21 files, 1.7 MB): `/profile` as owner, manager, practitioner, front desk; `/team/<nadia>` as owner, manager, practitioner (Tom), front desk; and one capture each of dashboard, diary, patients, patient record (Olivia), retention, insights (Patient base), performance, offers, team, settings, patient portal home, `/auth`, `/portal`. Chromium 1440 wide, full page, demo fixture, persona switcher and floating dock hidden.
- Script: `/tmp/pr-captures.mjs <base> <outDir>`; the same script writes `captures/after/` in P10 so names match one to one.

### p0-04-commit

- Committed the docs scaffold and the before-captures only (exact paths; nothing from `launch-plan/` or the other uncommitted files).
