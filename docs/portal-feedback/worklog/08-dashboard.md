# Phase 8: Dashboard

Branch `e2e_live`, on top of `26ee374`. 27 Sep 2026. Full-stack checkpoint (e2e, tsc, guards, responsive gate).

## Scope

Index bullets 021, 022, 023 (links), 024, 025 (links), 028, 031, 142.

## Changes

### Order and summary (021) — `dashboard.tsx`, `dashboard/attention-summary.tsx`

- Owners and managers read the page as: numbers → one-line **Attention summary** (`data-qc="attention-summary"`: "N urgent · M this week", the four biggest kinds as chips, "See everything" scrolls to `#attention`) → today's diary → Active treatment journeys → Attention needed and My tasks. Practitioners and receptionists keep the previous order (numbers, diary, lists, journeys).

### Week strip (022) — `dashboard/week-summary-strip.tsx`

- Owners and managers on the week view get a strip above the cards (`data-qc="week-summary"`): bookings this week with a per-day row, booked value (live bookings), and how full each practitioner is (booked minutes over 09:00–18:00 Monday to Saturday; the bar turns rose at 85 %). The footnote says the assumed hours; real working hours are the follow-on phase.

### Links (023, 025, 031) — `dashboard/kpi-grid.tsx`, `dashboard/treatment-journeys.tsx`, `patients.index.tsx`, `patients/journey-board.tsx`

- KPI cards are a `div` whose number and label link to the list; the chips underneath are links of their own (`data-qc="kpi-chip-<id>"`), so no link nests in a link: "N due" / "N overdue" → `/patients?view=due`, "£ at risk" / "N to chase" → `/retention`, "N overdue steps" → `/patients?tab=board&risk=1`, which opens the journey board on its at-risk cards (`risk` search param → `JourneyBoard initialAtRiskOnly`).
- Journey cards link to `/patients/$id?tab=treatments#plan` (`data-qc="plan-link"`), the record's Treatment plan card from Phase 7.

### Tasks (024) — `dashboard/follow-up-tasks.tsx`

- `TaskMeta` under each task: "Due 4 Oct · Dr Nadia Rahman"; an overdue date reads "Overdue since …" in rose. From `recall_tasks.due_at` (Phase 2) and `assigned_label`.

### Deposit copy (028)

- "Deposits must be paid at least N days before the appointment" reads `depositLeadDays` from `getDashboard` (Phase 4), which reads `clinics.deposit_lead_days`.

### Server-side week (142) — `schemas.ListAppointments`, `listAppointments` (production and demo)

- `practitioner_id` filter; the dashboard week view passes the practitioner's own id (not for managers) and no longer filters in the browser. The diary page is unchanged.

### Tests

- `e2e/feedback-corrections.spec.ts`: new owner-dashboard test (section order, summary, deposit copy, chip hrefs, plan link, task meta, week strip); the two chat tests and the record test now check the floating window instead of the removed docked panel.
- `e2e/patient-portal/sync.spec.ts`: staff side opens the floating chat through "Open chat".
- Hook rename: the journey card link is `data-qc="plan-link"` so the existing `[data-qc^="journey-"]` column-height check keeps matching columns only.

## Verification

| Check                       | Result                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Guards                      | policy / validators / tenancy / metrics ok                                                                                                       |
| Unit                        | 153 / 153; metrics 16 + 2 todo                                                                                                                   |
| tsc                         | 103 (baseline 103)                                                                                                                              |
| Lint                        | New files clean; `dashboard.tsx` −8 (three inherited indentation findings remain in the pre-existing diary block), `kpi-grid.tsx` 0, `follow-up-tasks.tsx` +1 inherited, `patients.index.tsx` 0 |
| Chromium e2e (full)         | 132 passed; failures: pre-existing `feedback-corrections:193`, `offers:84`, `reminders:10`, `treatment-workflow:63`; the three `patient-portal/sync` failures came from the Phase 7 panel removal and are fixed (6 / 6 after) |
| `test:responsive:gate`      | 434 / 434                                                                                                                                       |

## Captures

Owner dashboard, week view: KPI cards with linked chips, the Attention summary line, the week strip (48 bookings, £12,875, fullness per practitioner), then the diary cards. `/tmp/pf-p8-*.png` during the run.

## Notes

- The Attention summary counts the same items as the full list (server attention items plus the incomplete-profile items a manager sees), so the two never disagree.
- Fullness uses a fixed working week; once working hours and leave exist (follow-on), the strip should read them.
