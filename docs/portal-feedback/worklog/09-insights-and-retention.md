# Phase 9: Insights and Retention

Branch `e2e_live`, on top of `f5e9336`. 27 Sep 2026.

## Scope

Index bullets 071, 072, 073, 074, 081 (Patient base window), 083, 084, 085, 086.

## Changes

### Insights → Patient base (071, 081) — `insights.tsx`, `patients/patient-metrics.tsx`, `insights.server.ts`

- The period picker now sits on both tabs; the subtitle names the window ("Last 12 months. How big the patient base is…").
- `getPatientMetrics` (production and demo) takes `{ from?, to? }` (`schemas.GetPatientMetrics`; empty = last 12 months) and passes it to `buildBookMetrics`. Spend per patient, visit value and new vs returning follow the window; "Dormant" keeps its fixed meaning (no visit in 12 months) and says so. Tile hints use `periodPhrase`.
- `buildBookMetrics.lastVisit`: every patient by months since their last visit before the window's end — under 3, 3–6, 6–12, 12+, never treated. The **Patients by last visit** donut (`data-qc="last-visit-card"`, `last-visit-bucket`) replaces the Active vs inactive donut, which repeated the tile above it.

### Insights → Pipeline (072, 073, 074) — `insights/action-list.tsx`, `insights/funnel-chart.tsx`

- Both next-step lists return their full sets from `buildInsights` (the `slice(0, 12)` caps are gone) and paginate 10 a page with `PaginationBar` (`data-qc="waiting-pagination"` / `consulted-pagination`). "All" still selects every patient on the list.
- One row format: "Nd waiting · consulted 12/05/2026 · source" on the consulted list (days counted from the consultation); both lists sort longest wait first and both offer **Schedule** (`data-qc="insights-schedule"`); the consulted list keeps Open.
- "What sold" is removed from Insights (Phase 10 places it on Performance with retail's share); `buildInsights.bestsellers` stays for that.
- `src/lib/chart-palette.ts`: `CHART_SERIES` (butter, sky, pink, green, lilac from the brand tokens), `CHART_PAIR`, `CHART_MUTED`, `CHART_LINE`. The funnel chart and the Patient base donuts read from it, so neighbouring series stay apart on a projector.

### Retention (084, 085, 086) — `retention/at-risk-table.tsx`, `send-recall-dialog.tsx`, `retention-breakdown.tsx`, `retention-trend.tsx`

- At-risk table: the patient column is `sticky left-0` (header and cells, with a hairline shadow) so it stays put while the rest scrolls; the practitioner column and its sort are removed (`colSpan` 8). `practitionerId` / `practitioner` still travel on each row for the dialog.
- Send recall dialog: owners and managers see "Or hand it to the team → Assign to…" (`data-qc="recall-assign-section"`, `recall-assign-to`), which opens the same assign card the Retention hover used (`StaffTaskHoverCard` with `openOnClick`), pre-ticking the patient's practitioner and the front desk.
- Cohort table: `CohortCell` reads "Too early" for the current month (`data-qc="cohort-too-early"`), "N · R% so far" muted for cohorts younger than the 180-day horizon (`cohort-so-far`, from `CohortRow.tooEarly`), and a final rate otherwise (`cohort-final`). The trend's y-axis ticks read in %.

### Tests

- `e2e/retention.spec.ts`: two new tests — pinned patient column / no practitioner column / Assign to… in the dialog; Too early / so far / % axis.
- `e2e/patients.spec.ts` ("insights"): Patient base follows the picker, five last-visit buckets, no Active vs inactive, no What sold, pagination bar, Schedule and the shared wording on the consulted list.

## Verification

| Check          | Result                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `check:metrics`| ok (16 asserted + 2 todo)                                                                                                |
| Validators     | ok (117 validators; `GetPatientMetrics` added)                                                                           |
| Unit           | 153 / 153                                                                                                                 |
| tsc            | 103 (baseline 103)                                                                                                        |
| Lint           | `at-risk-table.tsx` −28 (the removed column), `retention-breakdown.tsx` −1, `insights.tsx` −1, others 0                  |
| e2e            | retention 5 / 5, feedback-corrections (bar the pre-existing `:193`), offers (bar `:84`), patients insights test           |
| Responsive     | insights, insights-book, retention on every device: 49 / 49                                                               |

## Captures

Patient base tab on the 12-month preset (tiles naming the window, the last-visit donut in brand colours); Send recall dialog with "Or hand it to the team". `/tmp/pf-p9-*.png` during the run.

## Notes

- Bullet 083 stays as decided in the review: first-to-second is one shared figure; the tile remains on Insights, the cohort view on Retention.
- The "New patients" bar chart still covers the last 12 months regardless of the picker and says so; changing its span was not asked for.
