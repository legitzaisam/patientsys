# Phase 8: tests, device matrix, full verification, after-captures

Branch `e2e_exp`, on top of `8949cf7`. 29 Sep 2026. Three new specs cover the three surfaces end to end for every role; the specs that touched the old Patients page are brought up to date; the gate runs on all seven devices; the whole Chromium suite, unit suites, guards, tsc, lint and the gateway smoke are re-run; the P0 scenes are captured again on a fresh demo server. Captures: [`captures/after/`](../captures/after/), 33 files (the 24 P0 names plus `tasks-{owner,practitioner,front-desk}--*`), side by side with `captures/before/` in the [index](../README.md#regression-proof).

Two product fixes came out of writing the tests; both are in this commit.

- **Same-pass escalation.** The evaluator escalated only tasks it had already seen, so a no-show found 14 days late was created in the front-desk pool on the first read and moved to the owner on the second — the pool read 31 rows, then 23. `evaluateRules` now marks a candidate whose `escalateAt` has already passed with `escalatedNow: { toId, toRole }` (same target logic as the open-task loop, now one `escalationTarget()` helper); `newTaskRow` creates it assigned to that person with `escalated_at` / `escalated_to` set, and the `created` event records `escalated_to` / `to_role`. Two unit cases: a 14-day-old no-show starts escalated to the owner, a fresh one starts in the pool.
- **A practitioner's "Show everyone".** Records wrote `prac=all` (the board's opt-out sentinel) but parsed it as a practitioner id, so the list read "You · 0 patients". `records-tab.tsx` treats `all` as no practitioner filter.

And two smaller ones: rule-task titles keep Title Case treatment names ("Rebook missed Chemical Peel", not "chemical Peel"; step titles like "microneedling session 2" still read lower-case), and on a narrow Tasks card the list title no longer shrinks under the type chips — the title is `shrink-0 whitespace-nowrap` and the chips wrap under it as a row (seen on the iPad-portrait after-capture).

### pt-p8-01-e2e-tasks

- `e2e/tasks.spec.ts` (new, 7 tests). Helpers: `openTasks`, `toast()` (reads the newest unseen toast and stamps it `data-seen=<n>` so the next read waits for a fresh one — sonner keeps earlier toasts mounted), `undo()` (clicks Undo and waits for the server's "Undone." toast), `reloadTasks()` (reload, wait for rows: the evaluator runs on read).
- Owner: lands on Whole team with the overdue / today / week groups, sidebar badge, Team rail, "closed automatically" line; a type chip → `?types=question` and only questions, every question row shows its reply target; My tasks has at most one assignee. Delegate panel: Suggested badge, five teammates, pick Sofia + Tomorrow + a note → "Lands in Sofia's Tasks", "Assign to Sofia", toast "… assigned to Sofia M. Added to their Tasks and dashboard."; the row leaves the pool and is in `?person=<Sofia>` with the note and `data-assignee`; a second delegate to Tom is undone and the row is back in the pool after a reload. Bulk: two rows checked → bulk bar, tap Maya → both rows hers, reassign back through the panel; "Mark handled" on one → undo → open again. Drag: a synthetic `dragstart` / `drop` onto Tom's Team row → assigned, visible in his person view. New task → picker → Olivia Bennett → assign dialog → Nadia → handled.
- Practitioner (Nadia): Assigned to me by default, Your day rail, no Team rail, no checkboxes; Clinical questions → Reply and Snooze 2h → snoozed → undone; Done… → four outcomes → "spoke, will book. Removed from the dashboard…" → undo → open after reload; Hand to front desk → "Sent to the front desk pool" → row gone → undo → back; My patients, with others → owner lines, no Delegate.
- Front desk (Sofia): My queue by default, Today's calls rail, no question chip, no question view; Front desk pool has no question rows; Claim → "claimed. It's in your queue"; Log outcome… (five outcomes) → No answer ×2 shows "Attempt 2 of 3" / "Attempt 3 of 3", the third → "Third attempt logged. … escalated to the clinic owner" → undo → after a reload `data-attempts="2"` and the rail shows "Retries scheduled".
- 7 / 7 on Chromium; the first runs found the toast-ordering and same-pass-escalation issues above.

### pt-p8-02-e2e-patients

- `e2e/patients-records.spec.ts` (new, 9 tests): the four Records tests moved out of `patients.spec.ts` (25 a page + practitioner chip + `view=due` token + paging; row → drawer, Tasks pill = drawer rows; Select → select-all-matching across pages, plus leaving Select clears; bulk dialog's portal-only line) and five new ones — every row has a type line (`Skin plan · n/m` / `Regular` / `New patient`, `· Inactive`) and a known `next-treatment` state, no Status column, the name link opens the record; a `sel=` deep link to a page-2 patient lands on page 2 with the row selected; drawer pills: Book opens "Book Olivia Bennett", Assign task → Plan support → template text → Nadia → Tomorrow → Save as rule preview "Plan support → Nadia R. → due tomorrow" → toast → the drawer lists it (type · who · when) and the row opens `/tasks?task=`; at 1024 px the drawer is a right-hand sheet that opens from the row and closes on Escape; practitioner: own book by default ("Nadia R. · N patients"), Show everyone → `prac=all` and "All practitioners", back to her book from the pill.
- `e2e/journey-board.spec.ts` (new, 4 tests): the two board tests moved from `patients.spec.ts` plus: a lit tile toggles off, a face scopes the tile counts to that row's pills and the label reads the short name, Clear resets both `tiles` and `prac`, the map has no buttons, a pill lands with that row selected; the `risk=1` deep link lights the three needs-a-human tiles and not the other three, Clear turns them off; every pill has a known risk, a patient and a name, no patient twice; practitioner: opens on her own row (one row at full opacity), Clear → `prac=all`.
- `e2e/patients.spec.ts` keeps search, the record tabs, the record-agreement, insights, the attention aggregates (owner / practitioner / front desk) and the plan-step tests; header comment updated.
- 13 / 13 (both new specs) plus `patients.spec.ts` 13 / 14 (the pre-existing insights period-picker failure).

### pt-p8-03-e2e-updates

- `e2e/retention.spec.ts`: header comment; the first test also asserts no task list on the page; the hand-off test now ticks a teammate, sends the recall task, reads the toast and finds the `recall` row for that patient on `/tasks?view=team&types=recall` with an "Assigned by" source line.
- `e2e/offers.spec.ts:265`: the patient-table send clicks the Select toggle first (checkboxes are behind it since P4). Found by the full run.
- `e2e/changelog/commit-captures.spec.ts` and `e2e/review/feedback-captures.spec.ts`: settle selectors `patients-filter-all` → `records-filter-bar`, `board-book` → `board-tiles` (only those two entries reformatted; the file's other long lines are pre-existing). Smoke-run against a demo server: `patients-list` and `journey-board` × 3 devices, 6 / 6.
- `e2e/responsive/pages.ts`: a stale doc comment removed; entries and states for `patients`, `patients-board`, `tasks` × 3 roles were added in P4–P6 and the dashboard entry already covers the summary card and Attention.
- `profile-governance.spec.ts` needed no change (its Attention assertions are on `staff_request` / `profile_change` chips); 8 / 8 with retention.

### pt-p8-04-unit-guards

| Check | Result |
| ----- | ------ |
| `vitest run` | 243 passed, 11 failed — the same 11 as P0 (`earnings` 1, `insights` 4, `period-picker` 5, `policy-scope` 1); `evaluate-rules` 10 / 10 |
| `check:policy` | ok — 191 handlers, all declared and calling `authorize()` |
| `check:tenancy` | ok — 62 tables (53 clinic-scoped, 9 exempt) |
| `check:validators` | the two pre-existing `saveAppointment` findings, nothing else |
| `check:metrics` | 16 / 17, the pre-existing insights recalc failure |

### pt-p8-05-device-matrix

`RESPONSIVE_GATE=major`, `--grep "· (patients|patients-board|tasks|tasks-practitioner|tasks-front-desk|dashboard|patient-record)$"`, all seven projects: **126 / 126** in 10.3 min (18 role runs per device). The table is in the [index](../README.md#device-matrix). No findings, so nothing to fix; the iPad-portrait title/chips overlap on Tasks was caught by eye on the after-capture (an overlap, not an overflow, so the probes do not see it) and fixed as above.

### pt-p8-06-full-verify

| Check | Result |
| ----- | ------ |
| Full Chromium e2e (`npx playwright test --project=chromium`) | 205 tests: 195 passed, 7 failed, 3 did not run. Six failures are the recorded pre-existing ones (`feedback-corrections:61/:205/:253`, `patients` insights, `reminders:10`, `treatment-workflow:60`; the three not-run are the rest of that serial file). The seventh, `offers.spec.ts:265`, was the Select toggle — fixed, `offers.spec.ts` 11 / 11 on a re-run. `team-chat-dock:100` passed this time. |
| tsc | 106 errors, 0 new against the 109 baseline (line-insensitive) |
| Lint | `new-by-line 0` on all 14 files changed in P8 (the P0–P7 files were gated per phase) |
| `node launch-plan/gateway/test.mjs` | 12 / 12 |

### pt-p8-07-after-captures

`node /tmp/pt-captures.mjs http://localhost:8091 docs/patients-tasks/captures/after` against a freshly started `DEMO=1` server on 8091 (so the fixtures carry no writes from the specs), three devices × 11 scenes = 33 files with the P0 names. Retaken once after the Tasks title fix and the title-case fix. Side-by-side table with the before/after deltas in the [index](../README.md#regression-proof).

### pt-p8-08-docs-commit

- Index: P7 and P8 commits, every P8 to-do `done` with its anchor, the device-matrix table and the regression-proof table.
- Commit on `e2e_exp` with the existing author; not pushed (no push unless asked).

## Phase summary

| Check | Result |
| ----- | ------ |
| New specs | `tasks` 7 / 7, `patients-records` 9 / 9, `journey-board` 4 / 4 |
| Updated specs | `patients` 13 / 14 (pre-existing), `retention` + `profile-governance` 8 / 8, `offers` 11 / 11, changelog captures 6 / 6 |
| Responsive gate, 7 projects | 126 / 126 |
| Full Chromium e2e | 195 / 205; only the recorded pre-existing failures |
| Unit | 243 + 11 pre-existing |
| Guards | policy 191 ok · tenancy 62 ok · validators 2 pre-existing · metrics 16 / 17 pre-existing |
| tsc / lint | 106 (0 new) / delta 0 |
| Gateway smoke | 12 / 12 |
| Commit | `d9b66fc` |
