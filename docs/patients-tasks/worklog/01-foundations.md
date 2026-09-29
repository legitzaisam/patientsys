# Phase 1: pure foundations

Branch `e2e_exp`, on top of `0bd63f3`. 29 Sep 2026. Five pure modules (no fetching, no React, no schema) that the later phases build on, each with its own unit test, plus the one palette addition.

### pt-p1-01-task-types

- `src/lib/tasks/types.ts` (new): the shared vocabulary. `TaskType` (`chase_booking | recall | question | send_offer | plan_support | rebook_no_show | custom`), `TaskStatus`, `TaskSource`, `TaskBucket`, `PoolRole`, `TaskRole`, `TaskView`. `TASK_TYPE_META` maps each type to its label, chip classes from the existing semantic families (`bg-warning-bg text-warning-ink` for chases, sky for recall, destructive for questions, `bg-accent-soft` for offers, success for plan support, the new `bg-noshow-bg text-noshow-ink` for rebooks), dot class and primary action. `ROLE_VIEWS` lists the left-nav views per role in display order (owner/manager: My tasks · Whole team · Unassigned · Front desk pool · Created by rules · Done today; practitioner: Assigned to me · Clinical questions · My patients, with others · Done today; front desk: My queue · Front desk pool · Retries due today · Done today). Constants `MAX_CONTACT_ATTEMPTS = 3`, `QUESTION_REPLY_HOURS = 4`, `RETRY_AFTER_DAYS = 2`.
- `dueBucket(dueAt, now)`: Overdue / Today / Later this week / Later on the clinic calendar; "this week" runs to Sunday, so a Monday task is "later" even on a Tuesday (the list shows a fourth group for it).
- `taskDueLabel({dueAt, type, escalated, status, resolution}, now)`: "2 days late", "Late today", "Today", "3h 22m left" for questions within the day, "Tomorrow", "Thu", "Before 5 Oct", "Escalated", "No due date", and the outcome label once done.
- `suggestedAssignee({type, patientPractitionerId, ownerId})`: clinical work to the patient's practitioner, offers to the owner, chasing to the front-desk pool. `suggestionReason`, `DUE_PRESETS` + `dueAtForPreset` (18:00 London on the chosen day, DST-safe; "Within 4 hours" is now + 4 h), `taskSourceLine`, `resolutionLabel`.
- `tests/unit/task-types.test.ts`: 5 tests.

### pt-p1-02-records-summary

- `src/lib/patients/records-summary.ts` (new): `patientType` (active plan → skin plan; no visits → new; else regular), `typeLine` ("Skin plan · 5/8", "Regular · Inactive"), `relativeAgo` ("5 days ago", "5 wks ago", "4 months ago", "2 years ago"), `nextTreatmentState` (booked = calm "23 Oct · Mesotherapy #2 / Booked"; unbooked and due within `REBOOK_WINDOW_DAYS = 14` = loud "Due in 3 days"; overdue = "95 days overdue"; due within 90 days = calm "Due 15 Nov"; else muted "Due Aug 2027"; nothing = "—"), `planSegments` (done / current / current_overdue / future), and `suggestedNextStep`, the drawer sentence generated from the patient's state in priority order: inactive → open urgent question → no-show → pending win-back offer → photos uploaded → overdue (mentions an opened booking link and who is chasing) → due inside the window → new patient with a consultation (form reminder) → plan-support task → booked ("All set…") → due later ("Rebook window opens soon…") → later → fallback. Each returns up to two actions from a fixed `SuggestionAction` set the drawer wires to real flows in P4.
- `tests/unit/records-summary.test.ts`: 8 tests. One thing learned: Node's en-GB short month for September is "Sept", the same call the app already uses elsewhere, so the story dates in the tests avoid September.

### pt-p1-03-board-risk

- `src/lib/patients/board-risk.ts` (new): `RiskKey` (`overdue | noshow | mismatch | nobook | ontrack`), `TileKey` (+ `due_this_week`), `RISK_META` (label, descriptor, fill / ink / dot / ring classes from destructive, noshow, sky, warning, accent, success), `boardRisk(plan)` reading the `planStepState` facts already on every plan row (no-show → booked-for-step → wrong booking → overdue → no booking), `dueBucketKey` (overdue / week ≤ 7 d / fortnight ≤ 14 d / later), `tileMatches` ("Due this week" = unbooked steps inside 7 days), `hitTile` (first selected tile a plan matches, OR semantics), `riskUrgency` (riskier then sooner), `RISK_DEEP_LINK_TILES` for the dashboard's `?risk=1`.
- `tests/unit/board-risk.test.ts`: 4 tests.

### pt-p1-04-staff-lane-triage

- `src/lib/staff-lane.ts` (new): `nameParts` (drops Dr / Mr / Mrs / Ms / Miss / Mx / Prof), `shortName` ("Dr Nadia Rahman" → "Nadia R."), `firstName`, `staffLane(id, name)` → `{ tone, initials, short, first }` where `tone` is the sidebar's own `laneFor(id)` so a practitioner reads the same colour on the Team list, the Records chips and the board rows, and `initials` is the app's `initialsOf` ("DN", as the sidebar shows today).
- `src/lib/tasks/urgent-triage.ts` (new): `triageMessage(body)` → `{ urgent, reason: symptom | worry | question | null }` from symptom words (swelling, redness, lump, pain…), worry phrases ("is this normal", "ok to", "should I"…) and aftercare questions ending in "?"; short pleasantries without a question are never urgent. `questionPreview` picks the first question, trimmed to 60 chars.
- `tests/unit/staff-lane-triage.test.ts`: 3 tests. One fix on the way: "OK to go to the gym the day after?" started with the "ok" pleasantry pattern, so the noise check now also requires no question mark.

### pt-p1-05-noshow-tokens

- `src/styles.css`: `--noshow: #e59a64`, `--noshow-bg: rgba(255, 218, 194, 0.55)`, `--noshow-ink: #8a4a1f` beside the destructive / success inks, and `--color-noshow`, `--color-noshow-bg`, `--color-noshow-ink` in `@theme inline` so `bg-noshow`, `bg-noshow-bg`, `text-noshow-ink`, `ring-noshow` exist. Nothing else in the palette changes; the alpha matches the sibling `-bg` tokens (0.48–0.55) rather than the mockup's 0.7 so it sits at the same weight as Overdue's pink.

### pt-p1-06-verify-commit

| Check | Result |
| ----- | ------ |
| Unit (the four new suites) | 20 / 20 |
| tsc | 109 = baseline |
| Lint | `base 0 now 0 new-by-line 0` on all five modules and four tests |
| Commit | see the index |
