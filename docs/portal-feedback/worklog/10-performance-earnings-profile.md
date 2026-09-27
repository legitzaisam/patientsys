# Phase 10: Performance, My earnings, My profile

Branch `e2e_live`, on top of `b64fa3a`. 27 Sep 2026.

## Scope

Index bullets 082, 097, 098, 099, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 117, 145.

## Changes

### Performance (097, 098, 099, 082, 104, 145)

- `performance-trends.tsx`: the Trends pills are gone; charts read the page's `trend` (built for the picker's window) and the hint says "By month / By day {phrase} — … The period follows the picker above." (`data-qc="trends-hint"`). The earnings chart is a `ComposedChart`, so the earned area and the collected line both draw. `trendViews` and `trendViewWindows` are removed from both servers and `earnings.server.ts`.
- `performance-table.tsx`: the expanded row's `Sparkline` insets its points and hides overflow, so the line and end dot stay inside the card. `showMoney` prop: without it the Earned and Outstanding columns, "to them", the money tiles, the commission link and the clinic-total money are not rendered; counts, attendance and retention stay (`data-qc="performance-table"`, `data-money`).
- `earnings.server.ts`: `withoutMoney(row)` zeroes every £ field and the commission rate; `whatSold(treatments, sales, products, period)` ranks treatments and products by revenue and gives retail's share of treatment + retail revenue.
- `getPractitionerPerformance` (production and demo): `showMoney = isOwner || permissions has reports.commission`; when false the rows, totals, clinic row, trend points and changes are stripped on the server and `sold` is null. When true the payload carries `sold` (from `product_sales` + `retail_products` in the period).
- `performance.tsx`: the money row, the Outstanding / Booked ahead / **Retail £N (X% of treatment and retail revenue)** line (`data-qc="performance-retail-share"`), the earnings chart and a **What sold** section (`performance-what-sold`, the Insights `Bestsellers` component) show only with the commission permission; the subtitle says why otherwise.

### My earnings (105–110) — `earnings.tsx`, `earnings-lines-table.tsx`

- Every card is the practitioner's share: **Your share**, Collected (share), Outstanding (share, from `outstandingShare`), Average per treatment (share); the header states "your rate is N%" (`data-qc="earnings-rate"`).
- Payout status per line ("Paid" once the linked booking is paid in full, else "Pending"; production and demo add `payout` to each line) with a "N paid · M pending · £ booked ahead (your share)" summary (`payout-summary`).
- Export CSV (`earnings-export-csv`: date, time, patient, treatment, share, payout) and Print / PDF (`earnings-print`, `window.print()`; buttons hidden in print).
- Distinct icons per card (Wallet, Coins, Hourglass, Receipt, Stethoscope, Users, UserPlus, Repeat).
- A spacer the height of the floating dock (`--dock-h`) follows the table so the period total clears the Alerts pill on tablets.
- Hidden for owners who do not treat: identity gains `treatsPatients` (production `readIdentity` counts the caller's treatments in the last 12 months; demo likewise). The nav link is hidden for such owners and `/earnings` shows a notice (`earnings-hidden`).

### My profile (111, 112, 113, 117) — `profile.tsx`, `profile-account-tabs.tsx`, `my-performance-kpis.tsx`

- One pill on the page header — Profile / Security / Documents (`data-qc="profile-tab-*"`); heading and subtitle follow the tab. `ProfileAccountTabs` renders the chosen pane and no longer carries its own pill.
- Registration body is a dropdown (GMC, NMC, GPhC, GDC, HCPC, None; an unknown saved value stays selectable); registration expiry, insurance provider, insurance expiry and qualifications fields save through `saveMyProfile` (Phase 2 columns). Number and registration expiry are disabled for "None".
- "Your performance" is a one-line summary of last month (share · treatments · patients · retention) with **See my earnings**; shown to practitioners and to owners who treat.
- Owner reminder: `src/lib/metrics/compliance.ts` → `complianceReminders(staff, todayKey)` adds an Attention row per registration or insurance expiring within 60 days (urgent inside 14 days or lapsed), linking to the team profile; `getDashboard` (production and demo) includes it for managers; the Attention list and summary know the `compliance_due` kind ("Registration or insurance").

### Tests

- `tests/unit/earnings.test.ts`: `withoutMoney` keeps counts and zeroes money; `whatSold` ranking and retail share.
- `e2e/feedback-corrections.spec.ts`: Performance (no trend pills, hint follows the picker, both series, retail share, What sold, money shown for the owner); My profile (tabs, dropdown, fields, summary link); practitioner My earnings (Your share, rate, payout summary, export, icons).
- `e2e/responsive/pages.ts`: `profile-security` and `profile-documents` states.

## Verification

| Check      | Result                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guards     | policy / validators / tenancy / metrics ok                                                                                                                              |
| Unit       | 155 / 155                                                                                                                                                                |
| tsc        | 102 (baseline 103; the earnings page rewrite cleared one)                                                                                                               |
| Lint       | `performance.tsx` −2, `performance-trends.tsx` −6, `performance-table.tsx` −11, `earnings.tsx` −7, `my-performance-kpis.tsx` −10, `profile.tsx` −8, `clinic.functions.ts` −2; others 0 |
| e2e        | feedback-corrections (bar the pre-existing `:244`), rbac, smoke: 47 passed                                                                                              |
| Responsive | performance, earnings, profile on every device: 49 / 49; profile tab states 12 / 12                                                                                     |

## Captures

Performance for the owner (no trend pills, hint naming the window, retail share line, What sold); My earnings for the practitioner (Your share cards, rate, payout chips, export); My profile with the header pill, registration dropdown and the earnings summary; the owner's Attention list with "Registration or insurance". `/tmp/pf-p10-*.png` during the run.

## Notes

- No demo persona is a manager, so the commission gating is asserted at the unit level (`withoutMoney`) and by the owner path in e2e; the production path is the same code.
- The demo owner (Dr Amara Osei) treats patients, so her Earnings link stays; the hide rule is exercised by the identity flag rather than by a fixture persona.
