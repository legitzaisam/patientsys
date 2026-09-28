# Phase 8: Schedule & time off

Branch `e2e_live`, on top of `9fdafa7`. 28 Sep 2026. The Schedule & time off tab as the mockup lays it out (`B-Schedule.dc.html`): working pattern and the month calendar on the left, the year's totals, the requests and the next bank holidays on the right (`lg:grid-cols-[minmax(0,1fr)_320px]`); and the right-hand sheet (`B-TimeOff.dc.html`) for requesting or adding time off. Everything reads from `getStaffSchedule` (P5) through the P2 helpers, so the calendar, the counts and the request list cannot disagree.

Captures: [`captures/p8-schedule/`](../captures/p8-schedule/) — `p8-schedule-practitioner.jpg`, `p8-calendar-next-month.jpg` (October: holiday, training, pending), `p8-time-off-sheet.jpg`, `p8-time-off-done.jpg`, `p8-schedule-manager-approved.jpg`, `p8-phone-schedule.jpg`, `p8-phone-sheet.jpg`.

### p8-01-working-pattern

- `src/components/profile/working-pattern-card.tsx` (new): `WorkingPatternCard({ mode, subject, pattern })`. Header "Working pattern · The front desk can only book you / them inside these hours."; the hour axis 07:00 · 11:00 · 15:00 · 19:00 · 21:00; seven rows (`pattern-row`) in a `48px 1fr 110px` grid — day, a `bg-glass-2` track with the `bg-foreground` bar positioned from the row's minutes, and "09:00–17:30" / "Off" on the right; footer "39 hours a week" (`metric:schedule.weeklyHours`, from `weeklyHours`).
- Self: `Request a change` (`pattern-request-change`) opens a small dialog (`pattern-note`, `pattern-request-send`) → `requestWorkingPatternChange({ note })` → the button becomes "Change requested ✓" (`pattern-change-requested`, green, disabled).
- Manage: `Edit hours` (`pattern-edit`) swaps the rows for `time` inputs per day (`pattern-start-<wd>`, `pattern-end-<wd>`) with a `Day off` / `Add hours` toggle (`pattern-toggle-<wd>`), a live weekly total, Cancel and `Save hours` (`pattern-save` → `setWorkingPattern({ userId, rows })`, invalidates `staff-schedule`, `staff-profile/<id>`, `my-profile`).
- Checked: probe — Nadia's seven rows and "39 hours a week"; the practitioner's change request lands (button flips); the owner turns Tuesday on 10:00–14:00 and saves → "Tue 10:00–14:00", "43 hours a week".

### p8-02-calendar

- `src/components/profile/time-off-calendar.tsx` (new): `TimeOffCalendar({ year, month, onMonth, pattern, timeOff, todayKey })`. Round Previous / Next (`calendar-prev`, `calendar-next`), title (`calendar-title`), legend Working / Holiday / Training / Pending. Monday-first grid from `monthGrid`; every cell (`calendar-day`, `data-state`, `data-day`) takes its state from `dayState`: work → `bg-glass-2` well with the hours tag ("9–5:30", `compactTime`); off → muted number; holiday → `bg-success-bg`; training → `bg-warning-bg` (the theme's lilac); sickness → `bg-destructive-bg`; pending → dashed `border-accent-deep bg-accent-wash`. Today has a ring.
- `schedule-tab.tsx` keeps the month in state; a month in another year fetches that year's rows through `useStaffSchedule(userId, mode, year)` (the hook gained the optional year; the key includes it).
- Checked: September = 21 work / 9 off; October = 17 work / 7 off / 5 holiday / 1 training / 1 pending; after the practitioner's request October shows 5 pending cells; after approval 6 holiday cells and no pending.

### p8-03-requests-column

- `src/components/profile/time-off-cards.tsx` (new):
  - `TimeOffSummaryCard` — "Time off in 2026", three wells taken (`metric:timeoff.taken`, glass) / booked (`metric:timeoff.booked`, success) / pending (`metric:timeoff.pending`, butter), and the `Request time off` / `Add time off` button (`timeoff-request`). Not rendered when the schedule came back without totals (a viewer who cannot manage).
  - `TimeOffRequestsCard` — "Your requests" / "Nadia’s requests"; pending rows first, then newest first; withdrawn rows hidden. Each row (`timeoff-row`, `data-status`) shows `timeOffLabel` ("Mon 19 – Fri 23 Oct"), `timeOffWhat` ("Holiday · 4 working days"), the note, and the status chip (`timeoff-status`). Self + pending: `Withdraw` (`timeoff-withdraw` → `withdrawTimeOff`). Manage + pending: `Approve` (`timeoff-approve` → `reviewTimeOff(approve: true)`) and `Decline` (`timeoff-decline` → dialog with an optional reason `timeoff-decline-note`, `timeoff-decline-confirm`).
  - `BankHolidaysCard` — the next three from `upcomingBankHolidays` (`bank-holiday`): Christmas Day Fri 25 Dec, Boxing Day (substitute) Mon 28 Dec, New Year’s Day Fri 1 Jan.
- Checked: probe — totals 14 / 5 / 1 → 14 / 5 / 4.5 after a 3.5-day request → 14 / 6 / 0 after the manager approves the remaining pending one; withdraw drops the pending rows 2 → 1.

### p8-04-time-off-sheet

- `src/components/profile/time-off-sheet.tsx` (new): `TimeOffSheet({ open, onOpenChange, mode, subject, pattern, todayKey, hasSeparateManager })`, a right `Sheet` (`sm:max-w-[520px]`, `timeoff-sheet`). Title "Request time off" / "Add time off for Nadia". Type pills Holiday / CPD · training / Sickness / Other (`timeoff-type-<t>`). "Dates · October 2026" with a small month stepper (`timeoff-prev-month`, `timeoff-next-month`, `timeoff-month`) and the hint "Tap the first day, then the last" → "Now tap the last day" (`timeoff-hint`); the month grid in a glass well (`timeoff-day-<key>`): edges `bg-foreground`, the span `bg-accent-soft`, days off muted, past days disabled on the self page. Below: the two half-day selects labelled with the picked days (`timeoff-start-half` Full day / Afternoon only, `timeoff-end-half` Full day / Morning only, disabled for a single day), "4 working days · your days off are skipped" (`timeoff-working-days`, from `workingDaysBetween` with the halves), the impact box (`timeoff-impact`, `bg-warning-bg`) "29 patients are booked on these days · Once approved, the front desk gets a list to rebook them and you won’t be booked on these days." from `listAppointments` (`practitioner_id`, cancelled excluded, unique patients), the note (`timeoff-note`). Footer "Goes to your clinic manager" / "Goes to the clinic owner" / "Lands approved", Cancel, `Send request` / `Add time off` (`timeoff-submit`). Self → `requestTimeOff`; manage → `addTimeOff({ userId })`. Done state (`timeoff-done`): "Request sent · Holiday · Mon 12 – Fri 16 Oct is with your manager. It shows as pending in your schedule until it’s approved." or "Time off added", `Back to schedule` (`timeoff-done-close`). `useUnsavedChanges` guards navigation once a day is picked or a note typed. Invalidates `staff-schedule`, `staff-profile/<id>`, `my-profile`, `staff-notifications`.
- `staff-profile-page.tsx`: the sheet is mounted for self and manage; the hero's `Request time off` / `Add time off`, the Your-week card's button and the summary card's button all open it.
- Checked: probe — practitioner picks Mon 12 – Fri 16 Oct → "4 working days · your days off are skipped", impact "29 patients are booked on these days", Morning only on the last day → "3.5 working days", done copy as above; owner adds Sickness on one day for Nadia → "Time off added … on Nadia’s schedule".

### p8-05-verify-commit

| Check | Result |
| ----- | ------ |
| Flows (demo) | request → pending cells in the calendar and a pending row → withdraw removes it; manager (keys on) approves → row Approved, calendar Holiday, totals booked +1; owner edits the pattern and saves; owner adds time off directly; front desk on Nadia sees no buttons and no totals card; phone 390 px `scrollWidth` 390, sheet full-width |
| tsc | 109 = after P7, no new errors |
| Lint | delta 0 on `working-pattern-card.tsx`, `time-off-calendar.tsx`, `time-off-cards.tsx`, `time-off-sheet.tsx`, `schedule-tab.tsx`, `staff-profile-page.tsx`, `profile-helpers.ts` |
| Console | no page or console errors in any probe |

Files: `src/components/profile/{schedule-tab.tsx, working-pattern-card.tsx, time-off-calendar.tsx, time-off-cards.tsx, time-off-sheet.tsx}` (new); `staff-profile-page.tsx`, `profile-helpers.ts` (`useStaffSchedule(year?)`); captures under `captures/p8-schedule/`.

Left for later: the front-desk layout (P9) replaces this tab for viewers who cannot manage; e2e coverage of these flows lands in `e2e/profile-redesign.spec.ts` (P10).

> Revised in P10: the totals and weekly-hours hooks are plain (`timeoff-taken|booked|pending`, `pattern-weekly-hours`); the sheet's month stepper buttons are 32 px and `shrink-0` (tap-target gate).
