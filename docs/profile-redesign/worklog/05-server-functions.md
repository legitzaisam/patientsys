# Phase 5: server functions — schedule, time off, bookable treatments, invoices, staff profile

Branch `e2e_live`, on top of `8b4b941`. 28 Sep 2026. Twelve new server functions (production in `clinic.functions.ts`, demo twins in `clinic.functions.demo.ts`), zod schemas in `schemas.ts`, POLICY rows in `policy.ts`; every handler calls `authorize()` (`check:policy` 182 handlers).

### p5-01-schedule-fns

- `getStaffSchedule({ userId?, year? })` (staff): pattern (seven rows via `fullPattern`), the year's time off, `totals` (taken / booked / pending) and `pendingCount`. Full detail for yourself or when `canManageProfiles`; anyone else gets approved future rows only, with `type` collapsed to "other" and no note — the "Unavailable" the front-desk view shows.
- `setWorkingPattern({ userId, rows[7] })` (managerCapability `team.manage_profiles`): validates both-or-neither times and end > start, replaces the seven rows, audits `staff.pattern_set`.
- `requestWorkingPatternChange({ note })` (staff): staff notification `pattern_change` to every owner, admin and — when the manager grant is on — manager, pointing at the Schedule tab. Returns how many were told.
- Helpers: `staffPatternRows`, `profileManagerIds`, `notifyStaffMembers`, `staffDisplayName` (production); `demoPatternRows`, `demoProfileManagerIds`, `demoNotifyStaff` (demo).

### p5-02-timeoff-fns

- `requestTimeOff` (staff, self): `working_days` from `workingDaysBetween` with the requester's own pattern and half-day ends; inserts pending; notifies the approvers (`time_off_request`) with "Nadia asked for Holiday · 4 working days (Mon 9 – Fri 13 Nov)".
- `withdrawTimeOff({ id })` (staff): only the caller's own pending row.
- `reviewTimeOff({ id, approve, reviewerNote })` (managerCapability): approved / declined with reviewer and time; the requester is notified (`time_off_reviewed`); audited.
- `addTimeOff({ userId, … })` (managerCapability): lands approved with the reviewer set; the colleague is told unless it is the caller's own row.

### p5-03-bookable-fns

- `listBookableTreatments({ userId })` (staff) joins `treatment_catalogue` for name and category, sorted by name. `setBookableTreatments({ userId, catalogueIds })` (managerCapability) replaces the set and audits `staff.bookable_set`.

### p5-04-invoice-fns

- `src/lib/invoices.server.ts` (new, shared): `invoiceEmail` (subject "Invoice INV-NR-2026-09 · September 2026 · £12,773.25" and a text body), `invoiceRecipientEmail` (payroll → clinic email, owner → owner's email), `InvoiceStore`, `sendInvoiceNow` (email through `sendEmail` — the staff channel the sign-in codes use, since the patient outbox needs a patient — then a `staff_notifications` row `invoice` to the owner(s), then `markSent`), `dueInvoices`, `deliverScheduledInvoices`.
- `listPractitionerInvoices({ userId? })` (staff; a colleague's need `canSetCommission`).
- `createPractitionerInvoice({ year, month, recipient, note, mode })` (staff, own only): refuses a month that has not started and a month already sent; amount and count from the same `earningsInputs` + `earningsLines` share maths as `getMyEarnings` (`practitionerMonthShare`); number `INV-<initials>-YYYY-MM`; `send` delivers now, `schedule` sets `scheduled_for` to the 1st of the next month. Re-running on a still-scheduled invoice updates it.
- `markInvoicePaid({ id })` (managerCapability `team.commission`): sent → paid, notifies the practitioner.
- The fixture invoice's amount now uses the practitioner's current rate on every line, as `earningsLines` does, so it reconciles with the earnings table (£14,604.75).

### p5-05-invoice-drain

- `deliverDueInvoices(db, clinicId?)` in `clinic.functions.ts` groups due rows by clinic and runs `deliverScheduledInvoices` with a store built from that clinic's rows; `dispatch.server.ts` calls it at the start of `drainDueCommunications`, before offer automation, inside its own try/catch. Demo: `deliverDemoInvoices()` runs first in `drainCommunications`.
- `tests/unit/invoices.test.ts`: the due filter (on/before today, scheduled only), delivery marks sent and notifies, the email text and recipient routing — 3 tests.

### p5-06-staff-profile-fn

- `getStaffProfile` returns `canManage` (self, or `canManageProfiles`), `canCommission` (`canSetCommission`, never for yourself), `pattern`, `patternSummary`, `bookable`, `upcomingUnavailable` (approved rows ending today or later, dates only, six at most). When the viewer cannot manage: registration number and expiry, insurance provider and expiry and the commission rate come back null, documents come back empty, and `capabilities` is null. Production and demo agree.
- `getMyProfile` returns `pattern`, `patternSummary` and `bookable`.

### p5-07-verify-commit

| Check | Result |
| ----- | ------ |
| `check:policy` | ok — 182 handlers (12 new, all declared, all calling authorize) |
| `check:validators` | only the two pre-existing `saveAppointment` problems; the 12 new validators match their schemas |
| `check:tenancy` | ok — 58 tables |
| Unit | 198 passed (+3 invoices), the 11 pre-existing failures unchanged |
| tsc | 116 = baseline |
| Lint | new blocks Prettier-formatted; 5 `no-explicit-any` in the same `db.x as any[]` / `{ from: (table) => any }` idiom the two files already use throughout; everything else delta 0 |
| Persona probes (demo) | practitioner: schedule self (5 working days, 14 / 5 / 1), request pattern change (3 told), request 9–13 Nov (4 working days), schedule September invoice, cannot set a pattern or mark paid; manager (keys on): sees commission 45 and registration, approves the request, sets bookable to 2, opens Nadia's earnings; front desk: no commission, no registration number, no insurance, no documents, time off as dates only, cannot review or open earnings; owner: sets the pattern, adds sickness, lists both invoices |
