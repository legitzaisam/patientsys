# Insights numbers audit

Demo seed only, clock pinned to `2026-09-20T12:00:00Z`, run in `Europe/London`.

- **Recalculation:** `insights-recalc.ts` reads the raw seed arrays and nothing else from the app, and works in integer pence and London time.
- **Page values:** `insights-shown.ts` calls each page's builder with the inputs its demo handler passes and the window its period picker sends.
- **Test:** `insights-recalc.audit.test.ts` compares the two and writes `insights-numbers.json`.
- **Tables:** `render-table.mjs` prints the tables below.

```sh
TZ=Europe/London npx vitest run --config vitest.metrics.config.ts docs/audits
node docs/audits/render-table.mjs
```

## Definitions used

These are the decisions agreed before the fix:

- **Visit:** one attended booking. Several treatments in one appointment are one visit. A treatment with no booking (a walk-in or an imported record) is its own visit.
- **No-show:** booked, but not a visit and not a treatment. A future consultation counts as booked, not consulted.
- **Earned:** the value of treatments performed. A refund takes the line off Earned and off Collected.
- **Collected:** paid in full, or the deposit share on a deposit-paid booking. Imported treatments with no booking were paid at the desk.
- **Outstanding:** Earned − Collected.
- **Dormant:** treated before, but no visit in the 12 calendar months before the window end. Never-treated patients are shown separately.
- **Following the picker:** New patients, Rebooked and the New patients chart all use the selected window.
- **Default window:** the 12 whole London calendar months ending with the current month. Nothing after now is counted or charted.
- **Rounding:** money is held in pence and rounded once, per line. Percentages are whole numbers. A list of shares uses largest remainder, so it adds to 100.

### Defaults this audit set (not in the brief)

- Patients with `deleted_at` are excluded everywhere.
- Archived patients stay in Total but not in Active. Their money still counts.
- The schema has no "rescheduled" status and no test-record flag, so neither is handled.
- Total, Active, Never treated, Dormant and the last-visit card are read as of the window end, so a 2019 window shows the 2019 list.

## Before the fix

81 of 174 rows did not match. The seed had no linking problems, but it had no refunds, no deleted or archived patients, no dormant patients and no booking across a clock change. Those edge cases were therefore untested.

#### Last 12 months (default)

Window shown: 2025-09-19T23:00:00.000Z → 2026-09-20T22:59:59.999Z. Recalculated: 2025-09-30T23:00:00.000Z → 2026-09-30T22:59:59.999Z.

| Metric | Where it appears | Definition | Source (file/function) | Value shown | Value recalculated | Match? | Problem found | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| Online enquiries | Insights → Funnel tile | Distinct people (by patient, then email) with an online enquiry, or a website-sourced record, in the window | `insights.server buildInsights` | 54 | 54 | Yes | Window was a trailing month/year from today, not whole calendar months (hidden in this window) | Calendar-month window from metrics/period |
| Booked | Insights → Funnel tile | Enquirers with any non-cancelled booking (future and no-show count as booked) or a visit on file | `buildInsights hasAnyAppointment` | 32 | 49 | **No** | Imported visits with no booking row read as not booked (17 people) | Booked = non-cancelled booking or a visit |
| Booked rate | Insights → Funnel tile | Booked ÷ enquiries | `FunnelTiles` | 59% | 91% | **No** | Wrong numerator (see Booked) | Follows Booked |
| Consulted | Insights → Funnel tile | Enquirers whose consultation has happened: a consult treatment, or an attended consult booking, up to now | `buildInsights firstConsultAt` | 7 | 7 | Yes | Counted future and no-show consult bookings (hidden in this window) | Only consultations that happened |
| Consult rate | Insights → Funnel tile | Consulted ÷ booked | `buildInsights` | 22% | 14% | **No** | Denominator fell back to enquiries; could exceed 100% | Consulted ÷ booked, blank when nobody booked |
| Treated | Insights → Funnel tile | Consulted enquirers with a non-consultation treatment up to now | `buildInsights` | 0 | 0 | Yes | — | — |
| Treatment rate | Insights → Funnel tile | Treated ÷ consulted | `buildInsights` | 0% | 0% | Yes | Showed 0% instead of blank for an empty stage (hidden in this window) | Blank (—) when nobody consulted |
| Waiting for a first booking | Insights → action list | Enquirers not booked; equals enquiries − booked | `buildInsights waiting` | 22 | 5 | **No** | Did not reconcile with the tiles | Same rule as Booked |
| Consulted, no treatment | Insights → action list | Consulted − treated | `buildInsights` | 7 | 7 | Yes | — | — |
| Chart months | Insights → funnel chart | One bar per London calendar month in the window, none after now | `seriesBuckets` | 13 | 12 | **No** | 13 bars with a repeated partial month; server-time-zone buckets | Whole London months |
| Chart enquiries (sum of bars) | Insights → funnel chart | Sum of bars = Online enquiries tile | `buildInsights monthly` | 54 | 54 | Yes | — | — |
| Chart booked (sum of bars) | Insights → funnel chart | Sum of bars = Booked tile (bars by enquiry month) | `buildInsights monthly` | 20 | 49 | **No** | Bars were first-booking dates, so they never summed to the tile | Bars count the enquiry cohort by enquiry month |
| Chart consulted (sum of bars) | Insights → funnel chart | Sum of bars = Consulted tile | `buildInsights monthly` | 7 | 7 | Yes | Same timing mismatch as booked (hidden at 12 months) (hidden in this window) | Cohort by enquiry month |
| Where enquiries came from (counts) | Insights → source mix | Enquirers by source; adds to enquiries | `buildInsights sources` | website 52, instagram 1, referral 1 | website 52, instagram 1, referral 1 | Yes | — | — |
| Where enquiries came from (%) | Insights → source mix | Whole percents by largest remainder, adding to 100 | `SourceMix` | website 96%, instagram 2%, referral 2% | website 96%, instagram 2%, referral 2% | Yes | Rounded each row separately (could add to 99 or 101) (hidden in this window) | Largest remainder |
| Bestsellers (count, £) | Insights → Bestsellers | Treatments performed in the window by name: count and earned value | `buildInsights bestsellers` | Laser Skin Resurfacing 68 · £31,650.00; PRP 71 · £26,150.00; Polynucleotides 63 · £24,740.00; … | Laser Skin Resurfacing 67 · £31,200.00; PRP 71 · £26,150.00; Polynucleotides 63 · £24,740.00; … | **No** | Float pounds, no refunds, trailing window | Pence, net of refunds |
| Retail revenue | Insights → Bestsellers | Retail sales in the window | `buildInsights` | 40600 | 40600 | Yes | Trailing window (hidden in this window) | Calendar window |
| Total patients | Insights → Patient base tile | Records not deleted, created on or before the window end | `buildBookMetrics` | 641 | 641 | Yes | Ignored the window end (a 2019 window showed today's 641) (hidden in this window) | As of the window end |
| Active | Insights → Patient base tile | Of Total, status active (archived stays in Total, not Active) | `buildBookMetrics` | 626 | 626 | Yes | Same as Total (hidden in this window) | As of the window end |
| Inactive | Insights → Patient base tile hint | Total − Active | `buildBookMetrics` | 15 | 15 | Yes | Same as Total (hidden in this window) | — |
| New patients (records created) | Insights → Patient base tile | Records created in the window | `buildBookMetrics newThisMonth` | 17 | 309 | **No** | Fixed to the calendar month; ignored the picker | Follows the picker |
| New patients chart (sum of bars) | Insights → New patients chart | Sum of bars = New patients tile | `buildBookMetrics monthlyNew` | 309 | 309 | Yes | Fixed last-12-months chart; never matched the tile (hidden in this window) | Chart follows the picker |
| Dormant | Insights → Patient base tile | Treated before, but no visit in the 12 months before the window end | `buildBookMetrics` | 4 | 0 | **No** | Included never-treated patients; fixed to today | Never-treated shown separately; as of window end |
| Dormant share | Insights → Patient base tile hint | Dormant ÷ Total | `buildBookMetrics` | £0.01 | £0.00 | **No** | Follows Dormant | Blank when Total is 0 |
| Never treated | Insights → composition | On the list at the window end with no visit by then | `buildBookMetrics` | 4 | 4 | Yes | Whole book regardless of window (hidden in this window) | As of window end |
| Time since last visit | Insights → last visit card | Months since last visit at the window end, by London calendar month; 12+ = Dormant | `buildBookMetrics` | under3 473, from3to6 81, from6to12 83, over12 0, never 4 | under3 475, from3to6 81, from6to12 81, over12 0, never 4 | **No** | 30.44-day months; 12+ disagreed with Dormant | Calendar months, same cut as Dormant |
| Seen in the period | Insights → composition | Patients with a visit in the window | `buildBookMetrics composition` | 637 | 637 | Yes | Visits were treatment rows (hidden in this window) | Visit = one attended booking |
| Treated once | Insights → composition | Seen patients with exactly one visit up to the window end | `composition` | 123 | 123 | Yes | Multi-treatment visits counted twice (hidden in this window) | Visits, not treatment rows |
| Two or more visits | Insights → composition | Seen patients with two or more visits | `composition` | 514 | 514 | Yes | As above (hidden in this window) | As above |
| First to second visit | Insights → quality tile | First visit in the window and 180+ days ago; returned within 180 days | `firstToSecond` | cohort 159, returned 123, rate 77% | cohort 149, returned 115, rate 77% | **No** | Second 'visit' could be another treatment in the same appointment | Visits |
| Rebooked | Insights → quality tile | Of patients seen in the window, those with a later non-cancelled booking | `buildBookMetrics ninetyDaysAgo` | 59 | 55 | **No** | Fixed 90 days to today; ignored the picker | Follows the picker |
| Revenue in the period | Insights → spend inputs | Earned in the window (net of refunds) | `buildBookMetrics` | £448,555.00 | £444,290.00 | **No** | Trailing window | Same earned as Performance |
| Spend per patient | Insights → quality tile | Earned ÷ patients seen | `buildBookMetrics` | £704.17 | £697.47 | **No** | Float pounds | Pence |
| Average visit value | Insights → quality tile | Earned ÷ visits in the window | `buildBookMetrics` | £256.61 | £255.78 | **No** | Divided by treatment rows | Divided by visits |
| Visits in the period | Insights → visit value input | Visits in the window | `buildBookMetrics` | 1748 | 1737 | **No** | Treatment rows | Visits |
| New vs returning | Insights → treated mix | Seen patients whose first visit is in the window vs before it | `buildBookMetrics treatedMix` | new 361, returning 276 | new 351, returning 286 | **No** | Trailing window | Calendar window |
| Where patients came from (lifetime) | Insights → sources card | Everyone on the list by record source (lifetime) | `buildBookMetrics sources` | walk_in 366, referral 100, website 96, instagram 51, other 28 | website 96, instagram 51, referral 100, walk_in 366, other 28 | Yes | Ignored the window end (hidden in this window) | As of window end |
| Total clients | Dashboard KPI | Records not deleted | `getDashboard (inline)` | 641 | 641 | Yes | — | One function for both handlers |
| Active clients | Dashboard KPI hint | Status active | `getDashboard (inline)` | 626 | 626 | Yes | — | — |
| Revenue this month | Dashboard KPI | Earned this London calendar month, net of refunds | `getDashboard (inline)` | £52,025.00 | £52,025.00 | Yes | Server-local month; ignored refunds (hidden in this window) | London month, earned rule |
| Treatments this month | Dashboard KPI hint | Treatments performed this London month | `getDashboard (inline)` | 215 | 215 | Yes | Server-local month (hidden in this window) | London month |
| Retention rate | Retention headline / Dashboard KPI | Patients seen in the 12 months to the window end with 2+ visits | `buildRetention rollingRate` | 64% | 64% | Yes | Treatment rows; 365 days (hidden in this window) | Visits; 12 calendar months |
| One visit only | Retention card (= Insights treated once) | = Insights treated once | `buildRetention` | 123 | 123 | Yes | Treatment rows (hidden in this window) | Visits |
| Repeat patients | Retention card (= Insights two or more) | = Insights two or more | `buildRetention` | 514 | 514 | Yes | Treatment rows (hidden in this window) | Visits |
| First to second (Retention) | Retention headline (= Insights) | = Insights first to second | `buildRetention` | 77 | 77 | Yes | — | — |
| Earned | Performance tile | Treatments performed in the window, net of refunds | `buildStats` | £448,555.00 | £444,290.00 | **No** | Trailing window; float pounds | Pence, calendar window |
| Collected | Performance tile | Paid in full, or the deposit share on deposit-paid bookings; refunds 0 | `buildStats collectedFor` | £441,044.00 | £436,779.00 | **No** | As Earned | As Earned |
| Outstanding | Performance tile | Earned − Collected | `buildStats` | £7,511.00 | £7,511.00 | Yes | — | — |
| Booked ahead | Performance subtitle | Live future bookings' value | `bookedAhead` | £95,405.00 | £95,405.00 | Yes | — | — |
| Earnings trend (sum of months) | Performance trend chart | Sum of the monthly trend = Earned | `buildTrend` | 44855500 | 44429000 | **No** | UTC month buckets (BST shifts midnight visits) | London month buckets |
| Earned per practitioner | Performance table | Per practitioner; adds to clinic Earned | `buildStats` | Amara £101,630.00, Nadia £181,190.00, Tom £165,735.00 | Amara £101,570.00, Nadia £179,890.00, Tom £162,830.00 | **No** | Trailing window | Calendar window |
| Collected per practitioner | Performance table | Per practitioner; adds to clinic Collected | `buildStats` | Amara £100,188.00, Nadia £178,362.00, Tom £162,494.00 | Amara £100,128.00, Nadia £177,062.00, Tom £159,589.00 | **No** | Trailing window | Calendar window |
| Your share | My Profile → Performance | Each line's value × its stamped rate, rounded to the penny per line | `buildStats share` | Amara £40,652.00, Nadia £81,535.50, Tom £69,608.70 | Amara £40,628.00, Nadia £80,950.50, Tom £68,388.60 | **No** | Float rounding per line | Integer pence per line |
| Collected (your share) | My Profile → Performance | Each line's collected × rate | `buildStats` | Amara £40,075.20, Nadia £80,262.92, Tom £68,247.48 | Amara £40,051.20, Nadia £79,677.92, Tom £67,027.38 | **No** | As above | As above |
| Outstanding (your share) | My Profile → Performance | Your share − collected share | `getMyEarnings` | Amara £576.80, Nadia £1,272.58, Tom £1,361.22 | Amara £576.80, Nadia £1,272.58, Tom £1,361.22 | Yes | — | — |
| CSV export (sum of shares) | My Profile → Export CSV | Sum of the CSV's share column = Your share | `practitioner-earnings toCsv` | Amara £40,652.00, Nadia £81,535.50, Tom £69,608.70 | Amara £40,628.00, Nadia £80,950.50, Tom £68,388.60 | **No** | Line share rounded differently from the tile | Same line share as the tile |
| Treatments | My Profile → Performance | Treatments performed in the window | `buildStats` | Amara 386, Nadia 738, Tom 624 | Amara 385, Nadia 734, Tom 615 | **No** | Trailing window | Calendar window |
| New patients (first visit) | My Profile → Performance | Patients whose first-ever visit is in the window | `buildStats patientFirstSeen` | Amara 62, Nadia 131, Tom 117 | Amara 71, Nadia 159, Tom 121 | **No** | Used the record's created date, not the first visit | First visit |

#### This month

Window shown: 2026-08-19T23:00:00.000Z → 2026-09-20T22:59:59.999Z. Recalculated: 2026-08-31T23:00:00.000Z → 2026-09-30T22:59:59.999Z.

| Metric | Value shown | Value recalculated | Match? |
|---|---|---|---|
| Online enquiries | 13 | 7 | **No** |
| Booked | 6 | 3 | **No** |
| Booked rate | 46% | 43% | **No** |
| Consulted | 3 | 2 | **No** |
| Consult rate | 50% | 67% | **No** |
| Treated | 0 | 0 | Yes |
| Treatment rate | 0% | 0% | Yes |
| Waiting for a first booking | 7 | 4 | **No** |
| Consulted, no treatment | 3 | 2 | **No** |
| Chart months | 5 | 1 | **No** |
| Chart enquiries (sum of bars) | 13 | 7 | **No** |
| Chart booked (sum of bars) | 2 | 3 | **No** |
| Chart consulted (sum of bars) | 2 | 2 | Yes |
| Where enquiries came from (counts) | website 11, instagram 1, referral 1 | website 5, instagram 1, referral 1 | **No** |
| Where enquiries came from (%) | website 85%, instagram 8%, referral 8% | website 72%, instagram 14%, referral 14% | **No** |
| Bestsellers (count, £) | Lip Filler 18 · £5,960.00; Mesotherapy 24 · £5,605.00; Jawline Filler 11 · £5,355.00; … | Lip Filler 14 · £4,680.00; Mesotherapy 15 · £3,575.00; Fat Dissolving 11 · £3,525.00; … | **No** |
| Retail revenue | 40600 | 24000 | **No** |
| Total patients | 641 | 641 | Yes |
| Active | 626 | 626 | Yes |
| Inactive | 15 | 15 | Yes |
| New patients (records created) | 17 | 17 | Yes |
| New patients chart (sum of bars) | 309 | 17 | **No** |
| Dormant | 4 | 0 | **No** |
| Dormant share | £0.01 | £0.00 | **No** |
| Never treated | 4 | 4 | Yes |
| Time since last visit | under3 473, from3to6 81, from6to12 83, over12 0, never 4 | under3 475, from3to6 81, from6to12 81, over12 0, never 4 | **No** |
| Seen in the period | 288 | 188 | **No** |
| Treated once | 29 | 12 | **No** |
| Two or more visits | 259 | 176 | **No** |
| First to second visit | cohort 0, returned 0, rate — | cohort 0, returned 0, rate — | Yes |
| Rebooked | 59 | 56 | **No** |
| Revenue in the period | £88,535.00 | £52,025.00 | **No** |
| Spend per patient | £307.41 | £276.73 | **No** |
| Average visit value | £243.23 | £238.65 | **No** |
| Visits in the period | 364 | 218 | **No** |
| New vs returning | new 30, returning 258 | new 12, returning 176 | **No** |
| Where patients came from (lifetime) | walk_in 366, referral 100, website 96, instagram 51, other 28 | website 96, instagram 51, referral 100, walk_in 366, other 28 | Yes |
| Total clients | 641 | 641 | Yes |
| Active clients | 626 | 626 | Yes |
| Revenue this month | £52,025.00 | £52,025.00 | Yes |
| Treatments this month | 215 | 215 | Yes |
| Retention rate | 64% | 64% | Yes |
| One visit only | 29 | 12 | **No** |
| Repeat patients | 259 | 176 | **No** |
| First to second (Retention) | — | — | Yes |
| Earned | £88,535.00 | £52,025.00 | **No** |
| Collected | £82,424.00 | £47,762.00 | **No** |
| Outstanding | £6,111.00 | £4,263.00 | **No** |
| Booked ahead | £95,405.00 | £95,405.00 | Yes |
| Earnings trend (sum of months) | 8853500 | 5202500 | **No** |
| Earned per practitioner | Amara £20,765.00, Nadia £33,265.00, Tom £34,505.00 | Amara £10,555.00, Nadia £20,480.00, Tom £20,990.00 | **No** |
| Collected per practitioner | Amara £19,568.00, Nadia £31,084.50, Tom £31,771.50 | Amara £9,687.00, Nadia £19,076.50, Tom £18,998.50 | **No** |
| Your share | Amara £8,306.00, Nadia £14,969.25, Tom £14,492.10 | Amara £4,222.00, Nadia £9,216.00, Tom £8,815.80 | **No** |
| Collected (your share) | Amara £7,827.20, Nadia £13,988.04, Tom £13,344.03 | Amara £3,874.80, Nadia £8,584.43, Tom £7,979.37 | **No** |
| Outstanding (your share) | Amara £478.80, Nadia £981.21, Tom £1,148.07 | Amara £347.20, Nadia £631.57, Tom £836.43 | **No** |
| CSV export (sum of shares) | Amara £8,306.00, Nadia £14,969.25, Tom £14,492.10 | Amara £4,222.00, Nadia £9,216.00, Tom £8,815.80 | **No** |
| Treatments | Amara 81, Nadia 147, Tom 136 | Amara 44, Nadia 87, Tom 84 | **No** |
| New patients (first visit) | Amara 5, Nadia 12, Tom 11 | Amara 1, Nadia 8, Tom 3 | **No** |

#### 1–31 Jan 2019 (no data)

Window shown: 2019-01-01T00:00:00.000Z → 2019-01-31T23:59:59.999Z. Recalculated: 2019-01-01T00:00:00.000Z → 2019-01-31T23:59:59.999Z.

| Metric | Value shown | Value recalculated | Match? |
|---|---|---|---|
| Online enquiries | 0 | 0 | Yes |
| Booked | 0 | 0 | Yes |
| Booked rate | — | — | Yes |
| Consulted | 0 | 0 | Yes |
| Consult rate | — | — | Yes |
| Treated | 0 | 0 | Yes |
| Treatment rate | — | — | Yes |
| Waiting for a first booking | 0 | 0 | Yes |
| Consulted, no treatment | 0 | 0 | Yes |
| Chart months | 5 | 0 | **No** |
| Chart enquiries (sum of bars) | 0 | 0 | Yes |
| Chart booked (sum of bars) | 0 | 0 | Yes |
| Chart consulted (sum of bars) | 0 | 0 | Yes |
| Where enquiries came from (counts) |  |  | Yes |
| Where enquiries came from (%) |  |  | Yes |
| Bestsellers (count, £) |  |  | Yes |
| Retail revenue | 0 | 0 | Yes |
| Total patients | 641 | 0 | **No** |
| Active | 626 | 0 | **No** |
| Inactive | 15 | 0 | **No** |
| New patients (records created) | 17 | 0 | **No** |
| New patients chart (sum of bars) | 309 | 0 | **No** |
| Dormant | 4 | 0 | **No** |
| Dormant share | £0.01 | — | **No** |
| Never treated | 4 | 0 | **No** |
| Time since last visit | under3 0, from3to6 0, from6to12 0, over12 0, never 641 | under3 0, from3to6 0, from6to12 0, over12 0, never 0 | **No** |
| Seen in the period | 0 | 0 | Yes |
| Treated once | 0 | 0 | Yes |
| Two or more visits | 0 | 0 | Yes |
| First to second visit | cohort 0, returned 0, rate — | cohort 0, returned 0, rate — | Yes |
| Rebooked | 59 | — | **No** |
| Revenue in the period | £0.00 | £0.00 | Yes |
| Spend per patient | — | — | Yes |
| Average visit value | — | — | Yes |
| Visits in the period | 0 | 0 | Yes |
| New vs returning | new 0, returning 0 | new 0, returning 0 | Yes |
| Where patients came from (lifetime) | walk_in 366, referral 100, website 96, instagram 51, other 28 |  | **No** |
| Total clients | 641 | 641 | Yes |
| Active clients | 626 | 626 | Yes |
| Revenue this month | £52,025.00 | £52,025.00 | Yes |
| Treatments this month | 215 | 215 | Yes |
| Retention rate | 0% | 0% | Yes |
| One visit only | 0 | 0 | Yes |
| Repeat patients | 0 | 0 | Yes |
| First to second (Retention) | — | — | Yes |
| Earned | £0.00 | £0.00 | Yes |
| Collected | £0.00 | £0.00 | Yes |
| Outstanding | £0.00 | £0.00 | Yes |
| Booked ahead | £95,405.00 | £95,405.00 | Yes |
| Earnings trend (sum of months) | 0 | 0 | Yes |
| Earned per practitioner | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| Collected per practitioner | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| Your share | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| Collected (your share) | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| Outstanding (your share) | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| CSV export (sum of shares) | Amara £0.00, Nadia £0.00, Tom £0.00 | Amara £0.00, Nadia £0.00, Tom £0.00 | Yes |
| Treatments | Amara 0, Nadia 0, Tom 0 | Amara 0, Nadia 0, Tom 0 | Yes |
| New patients (first visit) | Amara 0, Nadia 0, Tom 0 | Amara 0, Nadia 0, Tom 0 | Yes |

93 of 174 rows match. Seed problems: none.

### Problems, most misleading first

1. **Booked and the waiting list.** Imported visits have no booking row, so 17 treated patients sat on "Waiting for a first booking". Booked showed 59% when the real figure was 91%.
2. **Period picker ignored or mismatched.** "12 months" meant a trailing year from today, which produced 13 chart bars with a repeated partial month. "1 month" meant a trailing 31 days. New this month, Rebooked, Dormant and the New patients chart ignored the picker entirely. A January 2019 window still showed today's 641 patients.
3. **Visits counted as treatment rows.** A two-treatment appointment was two visits. This inflated Two or more visits, first-to-second, the retention rate and average visit value, and deflated visit value.
4. **Dormant included never-treated patients.** 4 patients were shown as dormant when none were.
5. **Consult rate.** Its denominator fell back to enquiries, so it could exceed 100%. Consultations still in the future, or missed as no-shows, counted as consulted.
6. **Chart bars and tiles never reconciled.** The bars counted first-booking and first-consult dates, while the tiles counted the enquiry cohort.
7. **Money.** Values were float pounds with no refund handling. The trend bucketed by UTC month, so a 00:30 BST visit on the 1st landed in the previous month. The dashboard used the server's local month.
8. **My Profile "New patients".** The hint said "first visit in this period", but the figure counted records created in the period.
9. **Source percentages** were rounded row by row, so they could add to 99% or 101%.
10. **Zero data.** Rates showed 0% instead of "—" when there was nothing to divide.

### Duplicate calculations found

- Months and buckets were built five ways: `period-picker` local trailing windows, `metrics/windows`, `insights.server` seriesBuckets, `retention.server` monthKey, and `earnings.server` UTC buckets.
- "Visits" were counted four ways: `definitions` visitsByPatient, `buildBookMetrics` byPatient, `retention.server` byPatient, and `buildStats` yearTreatments.
- Money was computed in `metrics/money` (moneyTotals and shareTotals), `buildStats`, `buildTrend`, `insights.server` bestsellers, `whatSold`, the inline dashboard revenue, and getMyEarnings line shares.
- Dashboard KPIs were written twice, once inline in each of the live and demo `getDashboard` handlers.
