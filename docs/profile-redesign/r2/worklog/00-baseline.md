# Phase 0: baseline and scaffolding

Branch `e2e_live`, on top of `b2bf012`. 29 Sep 2026.

### r2-p0-01-docs-index

- `docs/profile-redesign/r2/README.md`: phase table (P0, S, P1–P7 with worklog links and a commit column), the 49 to-dos from the plan's front matter in plan order (`id | phase | what | status | worklog anchor`), and the Regression proof section to be filled at P7.
- `docs/profile-redesign/README.md`: one line under the plan reference pointing at round 2.
- Worklog files are created as each phase starts; this is the first.

### r2-p0-02-baselines

| Check | Baseline |
| ----- | -------- |
| `tsc --noEmit` | 109 errors (`/tmp/r2-baseline-tsc.txt`; the round-1 baseline file `/tmp/pr-baseline-tsc.txt` holds the original 116). Every phase compares with `diff <(sort baseline \| strip positions) <(now)` and must add none |
| `check:policy` | ok — 182 handlers |
| `check:validators` | FAILED, pre-existing: `saveAppointment` missing `milestone_id` / unknown `set` (two problems, unchanged since round 1 P0) |
| `check:tenancy` | ok — 58 tables (49 scoped, 9 exempt) |
| `check:metrics` | 16 / 17, the pre-existing `insights-recalc.audit` mismatch |
| Unit | 198 passed, 11 failed pre-existing (`earnings` 1, `insights` 4, `period-picker` 5, `policy-scope` 1) |
| Chromium e2e (round-1 P10 run at `d9a6c78`) | 171 passed, 1 did not run, 9 failed: `feedback-corrections:61`, `:209`, `:257`, `patients:246`, `reminders:10`, `treatment-workflow:134`, `team-chat-dock:100` (all confirmed on the round-1 P0 commit), `team.spec:28` (Last-active day-boundary flake), `patient-portal/sync:101` (toast timing). This is the accepted set for P7 |
| `test:metrics` | 16 / 19: the three `/dashboard` mismatches are pre-existing (also fail on `786cf13`) |
| Responsive gate (`RESPONSIVE_GATE=major`, 7 devices) | 441 / 441 at `d9a6c78` |
| Lint | `/tmp/pf-newlint2.py` baselines for the 27 files this round may touch are in `/tmp/r2-baseline-lint.txt`; the seven stitching app files show `base n now n` against `HEAD`, so the uncommitted hand-off diff adds no findings (`handoff.ts` 0) |

### r2-p0-03-before-captures

`/tmp/r2-captures.mjs` (kept for the P7 after-set) against the raw demo app on 8099, 1440 px, JPEG 60 → `captures/before/`:

| File | Persona | What it shows |
| ---- | ------- | ------------- |
| `schedule-practitioner.jpg` | practitioner self | Schedule tab with the note-only "Request a change" dialog open |
| `schedule-owner-nadia-editor.jpg` | owner on Nadia | the pattern editor open — native `<input type="time">` fields (the boxy picker from the screenshot). Also visible: the pending time-off row in "Nadia's requests" wraps into a narrow column beside Approve / Decline — fixed in P5 when the card is touched |
| `overview-owner-nadia.jpg`, `overview-manager-nadia.jpg` | owner / manager on Nadia | Month-so-far card without a Create-invoice button |
| `earnings-practitioner.jpg` | practitioner self | tiles at the bottom of the tab |
| `invoice-dialog-practitioner.jpg` | practitioner self | the dialog before the print sheet |
| `registration-renew-practitioner.jpg` | practitioner self | "I've renewed" open with the native date input |
| `dashboard-owner.jpg`, `dashboard-manager.jpg` | owner / manager | Attention needed without a "Requests to approve" chip |

### r2-p0-04-commit

Committed with exact paths: the two READMEs, this worklog, the nine before-captures.
