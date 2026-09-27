# Phase 0: backup to e2e, baseline, worklog scaffold

Branch `e2e_live`, starting point `a21909d`. 27 Sep 2026.

## Scope

No product code. Three to-dos: back up everything built so far onto `e2e`, record the numbers every later phase is measured against, and create this folder.

## Changes

### Backup (`p0-01-backup-push`)

- Checked out `e2e_live` at `a21909d`, tree clean apart from local untracked files that are never committed (`.cursor/`, `Claude outputs/`, `.tmp-counts.mjs`, `docs/design-decision*.png`).
- Remote `e2e` was at `94fc1b6`, an ancestor of `a21909d` (`git merge-base --is-ancestor` confirmed), so the backup is a plain fast-forward.
- `git push https://<Zaisam token>@github.com/legitzaisam/patientsys.git e2e_live:e2e` → `94fc1b6..a21909d e2e_live -> e2e`. Token in the URL, keychain untouched, no `--force`, no history rewrite.
- Fetched with the same URL and moved the local `e2e` ref with `git branch -f e2e origin/e2e` without checking it out. `git ls-remote` shows `e2e` and `e2e_live` both at `a21909d`.
- From here `e2e` is the backup and every commit of this plan lands on `e2e_live`.

### Baselines (`p0-02-baseline`)

| Check                   | Command                                                            | Result                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Chromium regression e2e | `npx playwright test --reporter=list`                              | 131 tests: 123 passed, 5 failed, 3 skipped (5.1 min)                                                                           |
| Unit                    | `npx vitest run`                                                   | 16 files: 15 passed, 1 failed; 133 tests: 132 passed, 1 failed                                                                 |
| TypeScript              | `npx tsc --noEmit -p tsconfig.json`                                | 103 errors (all pre-existing; list saved as the delta baseline)                                                                |
| Guards                  | `check:policy`, `check:validators`, `check:tenancy`                | ok: 161 handlers, 115 validators, 52 tables                                                                                    |
| Responsive gate         | `npm run test:responsive:gate` (RESPONSIVE_GATE=major, 7 projects) | 434 passed, 0 failed (23.6 min)                                                                                                |
| Lint (non-Prettier)     | `eslint src e2e scripts`                                           | 608 `no-explicit-any`, 2 `prefer-const`, 21 `react-hooks/exhaustive-deps`, 42 `react-refresh/only-export-components`; 83 files |

Pre-existing e2e failures, all present at the branch point `94fc1b6` and left alone until the phase that owns them:

| Spec                                                          | Why it fails today                                                                                                       | Owned by                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `e2e/feedback-corrections.spec.ts:57` retention period picker | Expects the pill label "This year"; pills read "1 year"                                                                  | Phase 4 (labels become "Last 12 months") |
| `e2e/feedback-corrections.spec.ts:122` diary pre-read note    | Hover on "Open pre-appointment note" times out                                                                           | Not in this plan; noted                  |
| `e2e/offers.spec.ts:84` Draft with AI                         | `#offer-value` not filled without a Cohere key                                                                           | Not in this plan; noted                  |
| `e2e/reminders.spec.ts:10` reminder queue                     | Long-standing count mismatch                                                                                             | Not in this plan; noted                  |
| `e2e/treatment-workflow.spec.ts:63` arrived without consent   | Flaky: failed here and at the branch point, passed on the 26 Sep run; when it fails the three serial tests after it skip | Watched each phase                       |
| `e2e/feedback-corrections.spec.ts:137` practitioner KPIs      | Flaky: failed on the 26 Sep run, passed here                                                                             | Phase 4 / 10 touch its copy              |

Pre-existing unit failure: `tests/unit/policy-scope.test.ts` › "keeps destructive team administration on the owner" (`setRolePermission` moved to `accessAdmin` in the access-catalogue pull). Not in this plan.

### Scaffold (`p0-03-worklog-scaffold`)

- `docs/portal-feedback/README.md`: index of all 145 bullets of the to-do document (Future roadmap excluded), each mapped to a phase, a to-do id and a status; phase table with worklog links; the worklog template.
- This file.

## Verification

Covered by the baseline table above. Nothing to re-run.

## Captures

None in this phase.

## Notes

- Two screenshots the user saved under `docs/` (`design-decisions-1.png`, `design-decision-2.png`) are the record of the plan's decision rounds; left untracked.
- `Claude outputs/launch-plan/` is a superseded duplicate of the committed `launch-plan/`; left untracked.
