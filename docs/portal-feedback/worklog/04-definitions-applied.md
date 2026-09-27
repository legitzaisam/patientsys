# Phase 4: definitions applied to every builder and page

Branch `e2e_live`, on top of `541699e`. 27 Sep 2026. Closes the Before-2-October set (002, 003, 004) and pushes `e2e_live`.

## Scope

Index bullets 002, 003, 004, 014, 015, 048 (server side), 079, 080, 083 (shared figure), 087, 091–096, 102, 103, 128 (counts). Every builder that produces a headline number now reads `src/lib/metrics/`, so the same idea shows the same number on every page, and `tests/metrics/consistency.test.ts` asserts it against the snapshot.

## Changes

### Builders

| File                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/retention.server.ts`         | At-risk rows come from `dueState` (overdue has no 180-day cut-off; a booked patient is never at risk); `RiskLevel` gains `due_soon` and `counts.dueSoon`; "one visit only" and "repeat" from `composition` over patients seen in the window; cohorts and the summary's `firstToSecond` from the shared 180-day rule, with `tooEarly` on young cohorts; `atRiskCount` on the summary; `patientRetention` uses `dueState`.                                                                                                                                                             |
| `src/lib/retention-insights.server.ts` | Signals carry `dueSoon`, `tooEarly`, `firstToSecondRate`; the "only N% return" insight reads the shared rate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/insights.server.ts`          | Composition counts visits of any type over patients seen in the window (`composition.seen`); `secondVisit` and `quality.firstToSecond` from the shared rule; a consulted patient leaves "Waiting for a first booking"; pipeline buckets stop at now; `buildBookMetrics` takes a window and returns it.                                                                                                                                                                                                                                                                             |
| `src/lib/earnings.server.ts`          | Money model: Earned = treatments performed in the period, Collected = the paid part of those treatments via `collectedFor` (deposit = its share from Settings), Outstanding = Earned − Collected, `bookedAhead` = live future bookings; shares use the shared `share()` rounding so the builder and the snapshot agree to the penny; `buildStats` / `buildTrend` take `{ depositPercent, nowMs }`.                                                                                                                                                                                 |
| `src/lib/offers/cohorts.ts`           | Visits and the upcoming-booking set come from `visitsByPatient` / `upcomingBookingSet`; `stageOf` unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/metrics/definitions.ts`      | `TreatmentLike.name` and `AppointmentLike.status` accept `null` so production rows fit without casts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Server functions (production and demo in step)

- `getDashboard`: one query for every treatment carrying a due date plus one for live future bookings; `treatmentsOverdue` / `treatmentsDueSoon` are `dueState` counts over active patients with nothing booked (the old `≤ 30 days` query and the separate 12-row list are gone; the attention list shows the soonest dozen of the same population). Deposit urgency reads `clinics.deposit_lead_days`; the payload carries `depositLeadDays` for the Phase 8 copy.
- `getPractitionerPerformance` / `getMyEarnings`: treatment selects add `appointment_id`, appointment selects add `id`, future bookings are fetched for Booked ahead, the clinic's `deposit_percent` feeds the money model; totals gain `bookedAhead`. My earnings returns `outstandingShare`, `bookedAheadShare`, `commissionRate` and `averageShareValue` so every figure on that page is the practitioner's share (Phase 10 renders them).
- `listPatients`: `nextDue` is the most recent treatment carrying a date (the demo took the earliest date on file, which produced Finn Thornhurst's 2025 due date after a 2026 visit); each row carries `dueState`; the overdue open item follows it. `patients.index.tsx` filters the "Treatments due" view on `dueState`, so it equals the dashboard card.

### Labels and chips (014, 015, 087)

- `period-picker.tsx`: `periodPhrase(period)` → "in the last 12 months", "this month", "in Aug 2026", "on 5 Sep".
- Retention: every card hint names its window; the trend subtitle reads "Monthly return rate in the last 12 months."; the rate hint wraps instead of truncating and its change reads "up N pts since the period began".
- Dashboard KPI grid: the retention card loses its change chip; the revenue chip says "vs last month"; "Treatments due" hint reads "overdue or due in 30 days, nothing booked".
- Performance: info popover states the money model; Earned hint names the period; changes read as "£N more / less than the previous period" (they are £ differences, not percentages); a line under the totals gives Outstanding and Booked ahead (`data-qc="performance-booked-ahead"`); expanded rows gain a Booked ahead tile.
- Insights → Patient base: composition copy says whose visits it counts; first-to-second hint gives cohort, window and horizon.

### Tests and guard

- `tests/metrics/consistency.test.ts`: four builder comparisons flipped from `todo` to asserts — retention counts / one visit / repeat / first-to-second, insights composition / second visit, earnings totals and per-practitioner rows, offers `stageCounts`. `getDashboard` / `listPatients` stay `todo` for the rendered-number spec (Phase 12).
- `tests/unit/insights.test.ts`: encodes the agreed definitions (composition by visit count, 180-day first-to-second, consulted removed from the waiting list).
- `e2e/feedback-corrections.spec.ts`: rolling-window labels ("12 months" pill, "in the last 12 months", new Treatments-due hint). `e2e/consent-magic-link.spec.ts`: the message purpose is admin-only diagnostics since Phase 1, so the owner assertion now checks it is absent.

### Responsive fixes found by the gate

- `treatment-journeys.tsx`: plan name over two lines with the kind chip beneath (a chip beside a clamped name squeezed it to a sliver on iPad landscape).
- `retention.tsx` Stat card `min-w-0`; `at-risk-table.tsx` filter track scrolls sideways on phones and the collapsed search input follows its 36 px wrapper.

## Verification

| Check                       | Result                                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:metrics`             | ok — treatments due 115 (84 + 31), to chase 163 = at risk, one visit 123 = treated once, first-to-second 77% (123 of 159, 202 too early), earned £448,280 = £440,769 + £7,511, booked ahead £94,530, stages 4 / 19 / 89 / 2                    |
| `check:policy` / validators / tenancy | ok                                                                                                                                                                                                                                  |
| Unit                        | 153 / 153; metrics 16 asserted + 5 todo                                                                                                                                                                                                       |
| tsc                         | 103 (baseline 103)                                                                                                                                                                                                                            |
| Lint on changed files       | net −9 in `clinic.functions.ts`, −2 in the demo twin, 0 or fewer elsewhere; range-formatting of new lines reflowed a few adjacent lines in `performance.tsx` and `patient-metrics.tsx`                                                       |
| Chromium e2e (full)         | 124 passed, 5 failed: `feedback-corrections:124`, `offers:84`, `reminders:10`, `treatment-workflow:63` pre-existing; `consent-magic-link:17` fixed afterwards and re-run green; `feedback-corrections:57` now passes                          |
| `test:responsive:gate`      | 424 / 434 first run; the 10 failures (retention on phones, dashboard on iPad landscape) fixed as above and re-run green cell by cell                                                                                                          |

## Captures

Dashboard (115 due = 31 + 84, 163 to chase, no chip on the retention card), Retention (84 / 22 / 26, one visit 123), Performance (£448,280 / £440,769, Outstanding and Booked ahead line), Patients "Treatments due" (115 records), Insights Patient base (77%, 123 / 514 of 637). Files under `/tmp/pf-p4-*.png` during the run; the Phase 12 review pack re-captures them.

## Notes

- Retention's headline rate is still the rolling 12-month return rate whatever the picker says; its hint says so. Changing the rate's window itself was not in the feedback.
- The demo fixture has almost no treatments before September 2025, so "previous period" comparisons on 12-month views read as the whole current figure. Real data will not have this shape.
- `patients.index.tsx` still filters in the browser on the server-decided `dueState`; Phase 6 adds pagination and the "No upcoming treatment" chip on the same field.
