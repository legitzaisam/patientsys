# Phase 3: metrics module and invariants

Branch `e2e_live`, on top of `a5272d4`. 27 Sep 2026.

## Scope

Index bullets 004 (definitions), 015 (rolling windows, active pill), 081 (12 months rolling), 091–094 (one set of definitions), 002 / 102 (money model), 112 (active period highlighted). This phase builds the layer; Phase 4 moves the builders and pages onto it.

## Changes

### `src/lib/metrics/` (new)

| File                   | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `definitions.ts`       | `visitsByPatient`, `nextDueFor` (most recent treatment carrying a due date), `isUpcomingBooking` / `upcomingBookingSet` / `hasUpcomingBooking`, `dueState` → `booked / never / overdue / due_soon / lapsing / lost / current / none`, `dueStates` and `countDueStates` (`treatmentsDue = overdue + due_soon`, `toChase = overdue + due_soon + lapsing + lost`), `seenInWindow`, `composition` (never / once / two or more by visit count), `firstToSecond` (cohort = first visit in the window and at least 180 days old; returned = second visit within 180 days; `pending` for "too early"), constants `DUE_SOON_DAYS 30`, `LAPSING_DAYS 90`, `LOST_DAYS 180`, `SECOND_VISIT_HORIZON_DAYS 180`. |
| `appointment-flags.ts` | `phaseOf` (moved here from `arrival-alerts.tsx`, which imports it in Phase 5), `isRunningLate`, `daysUntil`, `appointmentFlags(a, { nowMs, depositLeadDays })` → `unpaid`, `deposit_due` (urgent inside the lead window, else this week), `balance_due`, `consent_due`, `running_late`, `no_show`, `details_incomplete`; `FLAG_LABEL`; `NEEDS_ACTION_TYPES` in menu order.                                                                                                                                                                                                                                                                                                                        |
| `money.ts`             | `collectedFor` (paid = full price, deposit_paid = deposit share from Settings, unpaid = 0, no linked booking = paid unless told otherwise), `moneyTotals` (earned, collected, outstanding = earned − collected), `bookedAhead` (live future bookings), `share`, `shareTotals` (per-treatment snapshot rate), `inPeriod`.                                                                                                                                                                                                                                                                                                                                                                          |
| `windows.ts`           | `trailingMonthsWindow`, `trailingDaysWindow`, `clampToNow`, `monthBucketsUpToNow` (last bucket ends at now), `noFutureBuckets`, `windowLabel` ("Last 7 days" … "Last 12 months").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `snapshot.ts`          | `metricsSnapshot(rows, { nowMs, window, practitionerId? })`: every headline number by page (dashboard, retention, insights, performance with per-practitioner shares and booked ahead, offer stage counts) plus the per-patient due-state map.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `demo-rows.ts`         | The demo fixture as `SnapshotRows` for the tests, the guard and (Phase 12) `/api/demo/metrics`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `index.ts`             | Barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Period picker (015, 081, 112)

- `"1y"` is a trailing 12-month window ending today (`PRESET_MONTHS["1y"] = 12`); `CURRENT_YEAR` and `CURRENT_MONTH` carry their presets so the pill is always highlighted. Headings: "Last 7 days", "Last month", "Last 6 months", "Last 12 months". Pill labels: "7 days", "1 month", "6 months", "12 months". `periodWindowLabel` for a preset reads as its two dates. `activePreset` maps an un-presetted `month` / `week` / `year` at offset 0 to the nearest pill. The bare calendar year is still reachable by key for anyone who asks.
- `tests/unit/period-picker.test.ts`: headings updated; a new case pins the rolling window (20 Sep 2025 – 20 Sep 2026) and the still-available calendar year.

### Tests and guard

- `tests/unit/metrics-definitions.test.ts` (18 cases): booked never due; overdue without cut-off; due soon boundary at 30 days including today; latest-treatment due date (the Finn Thornhurst case); lapsing / lost by days since; archived and never-treated out of scope; counts add up; composition counts visits not types and sums to the population; first-to-second horizon and pending; empty cohort → null; deposit urgency by lead days (3 and 7); balance due; cancelled carries nothing; running late at 5 and 15 minutes; details incomplete; deposit share and Earned = Collected + Outstanding; share model with snapshot rates; booked ahead ignores cancelled and past; rolling 12-month buckets never past now.
- `tests/metrics/consistency.test.ts` under `vitest.metrics.config.ts` (defines `__DEMO_MODE__` and a pinned `__DEMO_NOW__`, default `2026-09-20T12:00:00Z`, overridable with `DEMO_NOW`) over the real demo `db`: 12 invariants asserted today (dashboard due = overdue + due soon; to chase = retention at risk = sum of its bands; every booked patient reads `booked`; one visit only = treated once; composition sums to the seen population; one first-to-second figure; earned = collected + outstanding in total and per practitioner, share never above gross; booked ahead ≥ 0; single treatment ⊆ one-visit patients; no future buckets). Nine `todo` cases name the builder comparisons (Phase 4) and the UI-wired ones (Phase 7). The suite writes `test-results-metrics/snapshot.json` (gitignored).
- `scripts/check-metrics.mjs` runs that config and prints the reconciliation table (page · metric · value · definition); `npm run check:metrics`, added to `verify`.

Reconciliation table on the fixture at the pinned clock:

```
dashboard    treatments due   115   overdue 84 + due soon 31
dashboard    to chase         163   = retention at risk (lapsing 22, lost 26)
retention    one visit only   123   = insights treated once
insights     seen in window   637   never 0 + once 123 + two or more 514
insights     first-to-second  77%   123 of 159 within 180 days (202 too early)
performance  earned           £448,280 = collected £440,769 + outstanding £7,511; booked ahead £94,530
offers       stages           4 / 19 / 89 / 2
```

The dashboard today says 272 due and 137 to chase, Retention 51 overdue and 112 one visit, Insights 123 treated once, Offers 20 / 90 — the differences are exactly what Phase 4 resolves by moving each builder onto these functions.

## Verification

| Check           | Result                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Unit            | 17 files, 152 passed (was 133; +18 definitions, +1 picker)                                       |
| `check:metrics` | ok, 12 passed, 9 todo                                                                            |
| `tsc --noEmit`  | 103, identical to baseline                                                                       |
| ESLint          | no new findings; `period-picker.tsx` keeps its 10 pre-existing `only-export-components` warnings |

## Captures

None (no UI change beyond the picker labels, captured in Phase 4).

## Notes

- The consistency suite lives in `tests/metrics/` (not `tests/unit/`) so the plain unit run does not load the demo fixture with the real clock; `check:metrics` is the way to run it.
- `arrival-alerts.tsx` still has its own `phaseOf`; Phase 5 switches it to the shared one when the diary flags are wired.
- Unlinked treatments (no `appointment_id`) count as paid in the money model; the 11 hand-written demo treatments fall in that group. Say if walk-ins should count as outstanding instead.
