# Phase 6: Patients list and journey board

Branch `e2e_live`, on top of `e1aa2a6`. 27 Sep 2026.

## Scope

Index bullets 045, 046, 047, 048 (list side), 049, 052, 053 (list side), 054, 055, 056, 057 (practitioner default).

## Changes

### Patients list (`src/routes/_authenticated/patients.index.tsx`)

- **Pagination (055)**: 25 a page through `PaginationBar` (first / previous / next / last, "Showing a–b of N patients"); the page is a URL search param (`?page=3`) so a refresh or shared link keeps it; changing a filter drops it back to page one; a page past the end clamps.
- **Filters (048)**: All / Active / Inactive / Treatments due / No upcoming treatment, plus My patients for practitioners. Each chip carries its count over the current search. "Treatments due" and "No upcoming treatment" read the server-decided `dueState` from Phase 4 (115 and 314 on the fixture; the due count equals the dashboard card). `data-qc="patients-filter-<key>"`.
- **Practitioner default (057)**: no `view` in the URL means the role's default — practitioners land on My patients (rows whose `practitionerIds` include them), everyone else on All. `validateSearch` leaves `view` undefined when absent.
- **Selection (047, 052)**: "Select patients to send an offer." above the table until something is selected (`data-qc="select-hint"`); the header checkbox covers every matching row across pages; a "Select all N matching" link (`select-all-matching`) appears beside Send offer while the selection is partial; the selection survives paging (it clears only when the view or search changes).
- **Columns (053, 054)**: `NextTreatmentCell` reads "Booked 28 Sep · treatment #n", "Due 12 Oct · treatment", "Overdue since 14 Nov 2025 · treatment" (rose) or "No upcoming treatment", from `dueState` (`data-qc="next-treatment"`, `data-state`). The open-tasks pill is a link to `/patients/$id?tab=treatments#recall` (`open-tasks-pill`); Phase 7 anchors the card. Names stay surname-first here only (`displayName`, Phase 1).
- The action group can shrink and wrap (`min-w-0`), found by the responsive gate on iPad mini.

### Data

- `listPatients` (production and demo) returns `practitionerIds` and the contact / consent fields (`email`, `phone`, `marketing_opt_in`, `email_opt_in`, `sms_opt_in`, `reminders_opt_in`, `unsubscribed_at`) so the bulk offer dialog can state the PECR position.
- `listTreatmentPlans` (production and demo) returns `nextBookingAt`: the patient's earliest live booking.

### Offers (056)

- `send-offer-dialog.tsx`: for a bulk send, "N of M haven't opted into marketing, so they'll see it in their portal only." (`data-qc="offer-portal-only-warning"`), from `describeOfferChannels` over the selected rows.
- `offers/send.ts`: `OfferStore.closeRecallTasks?(patientId)`; `sendOfferToPatients` calls it after each successful send. Production store completes the patient's open / contacted `recall_tasks`; the demo store does so when built with `{ closeTasks: true }` (manual sends). The automation stores do not implement it, so scheduled offers leave tasks alone.

### Journey board (`src/components/patients/journey-board.tsx`, 045, 046, 049)

- Cards are `li`s with the record link inside and a footer row (status chip, practitioner, Book), so the Book button is not nested in a link.
- **Book (045)**: on at-risk cards without a live booking (`data-qc="board-book"`), opens `QuickAddAppointment` centred with the patient and their practitioner pre-filled (new `defaultPatientId` prop on Quick add).
- **Dates (049)**: "Booked 28 Sep" when `nextBookingAt` exists, else "Due 28 Sep" / "Due today" / "Due tomorrow" / "Nd overdue" (`data-qc="board-date"`).
- **Late rule and order (046)**: the progress bar is `bg-destructive-ink/60` once the next step is overdue (the dashboard's rule); each column sorts overdue, then no-booking, then on-track, then by name (`data-risk` on the card).
- Practitioners are fetched for every role now, so the Quick book practitioner list is complete.

### Tests

- `e2e/patients.spec.ts`: four new tests — pagination and URL page, filter counts and the due view's states, hint / select-all-matching across pages / task pill link, bulk dialog portal-only line, board order / labels / Book pre-fill.
- `e2e/offers.spec.ts:141`: the automation test now searches for its patient rather than assuming they are on page one.
- `e2e/responsive/pages.ts`: `board-book` state on `patients-board`.

## Verification

| Check      | Result                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit       | 153 / 153                                                                                                                                                                       |
| tsc        | 103 (baseline 103)                                                                                                                                                              |
| Validators | ok                                                                                                                                                                              |
| Lint       | `journey-board.tsx`, `send-offer-dialog.tsx`, `send.ts`, demo twin, e2e: delta 0; `clinic.functions.ts` −2; `patients.index.tsx` +25, all indentation inherited from the pre-existing mis-indented `<>` fragment the new lines sit in |
| e2e        | patients 7 / 7, offers (bulk send, PECR, portal), comms, unsubscribe, consent-magic-link, feedback-corrections, smoke, rbac, portal, documents: 74 passed; failures only the pre-existing `feedback-corrections:126` and `offers:84` |
| Responsive | patients and patients-board on every device: green after the action-group fix                                                                                                  |

## Captures

Patients list on the Treatments due view (115 records, chips with counts, hint, dated Next treatment column); journey board with Quick book opened from a card's Book button, patient and practitioner pre-filled. `/tmp/pf-p6-*.png` during the run.

## Notes

- The record's `#recall` anchor and the owner's lifetime spend line land in Phase 7 (053, 057 stay in progress).
- Filtering still happens in the browser over the full list the server returns (641 rows); the states it filters on are decided on the server. Server-side paging was not asked for and the list is small.
