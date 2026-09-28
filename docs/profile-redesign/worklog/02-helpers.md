# Phase 2: pure schedule, time-off, calendar, bank-holiday and invoice helpers

Branch `e2e_live`, on top of `25bf35f`. 28 Sep 2026. One new module, `src/lib/staff-schedule.ts`, no I/O; every date is a `YYYY-MM-DD` clinic-local day.

### p2-01-pattern-helpers

- `WEEKDAYS` (Monday-first), `Weekday`, `PatternRow { weekday, start, end }` (null times = off), `fullPattern` (7 rows from any subset), `isWorkingDay`, `weeklyHours` (Nadia's pattern = 39), `compactTime` ("17:30" → "5:30"), `patternSummary` grouping consecutive days with the same hours ("Mon, Wed 9–5:30 · Thu 12–8 · Fri 9–3 · Sat 9–5"; "Hours not set" when empty), `rowLabel` ("09:00–17:30" / "Off").
- Date primitives alongside: `dayKey`, `parseDayKey`, `dayKeyOf(instant)` in the clinic time zone, `weekdayOf`, `addDays`, `daysInclusive`, `daysInMonth`, `shortDay` ("Mon 28", "Wed 14 Oct"), month name tables.

### p2-02-timeoff-helpers

- `TIME_OFF_TYPES` / labels, `TIME_OFF_STATUSES`, `TimeOffLike`; `workingDaysBetween(from, to, pattern, startHalf, endHalf)` counts pattern working days inside the range (reversed ranges accepted) and takes half a day off either end; `overlapsRange`; `timeOffTotals(rows, year, today)` → taken (approved, started), booked (approved, ahead), pending; `timeOffLabel` ("Fri 30 Oct", "Mon 19 – Fri 23 Oct", cross-month form) and `timeOffWhat` ("Holiday · 4 working days").

### p2-03-calendar-helpers

- `monthGrid(year, month)` Monday-first cells with leading blanks; `dayState(key, pattern, timeOff)` → approved type, else pending, else work / off (withdrawn and declined rows ignored); `nextDays(from, n, pattern, timeOff)` for the "Your week" card.

### p2-04-bank-holidays

- `UK_BANK_HOLIDAYS` for England and Wales 2026 and 2027 from gov.uk, substitute days labelled; `upcomingBankHolidays(today, 3)`.

### p2-05-invoice-helpers

- `initialsOf("Dr Nadia Rahman") = "NR"`, `invoiceNumber` (`INV-NR-2026-09`), `invoicePeriod`, `nextInvoiceSendDate` (1st of the next month, December rolls the year), `yearMonthOf`, `previousMonth`.
- Earnings grouping for the table and chart: `groupLinesByDay` / `groupLinesByMonth` / `groupLinesByTreatment` (treatments, earned, outstanding from pending lines; day and month newest first, treatments by earnings), `dailyEarnings(lines, year, month)` filling every day of the month for the bars.

### p2-06-unit-tests

- `tests/unit/staff-schedule.test.ts`: 17 tests over the mockup fixtures — Nadia's pattern, October 2026's grid (three leading blanks), 9–13 Nov = 4 working days with Tuesday off, half days, the year's totals (14 taken / 5 booked / 1 pending on 28 Sep), the next three bank holidays, invoice numbering and the grouping helpers.

| Check | Result |
| ----- | ------ |
| Unit | `staff-schedule.test.ts` 17 / 17; whole unit suite 195 passed, the 11 pre-existing failures unchanged |
| tsc | 116 = baseline (no errors in the new module) |
| Lint | both new files Prettier-formatted, 0 findings |
