# Phase 7: Patient record

Branch `e2e_live`, on top of `b2dc94c`. 27 Sep 2026.

## Scope

Index bullets 053 (record side), 057 (owner spend, receptionist view), 058, 059, 069, 070, 124.

## Changes

### Header (058, 057, 059) — `src/routes/_authenticated/patients.$id.tsx`

- Record treatment stays a primary button (now behind `patient-record-treatment`, i.e. `treatments.record`); **Open chat** sits beside it with an unread badge for this patient (`data-qc="open-chat"`, `open-chat-unread`, from `getUnreadMessages().items`).
- Send form, Send offer and Archive / Restore moved into a ⋯ `DropdownMenu` (`record-more`, `menu-send-form`, `send-offer-open`, `menu-archive`, `menu-restore`). Archive is for managers (matching the Phase 2 policy), still confirms in its dialog and still states the 8-year retention clock.
- Owners see `· £N lifetime spend` on the visits line (`record-lifetime-spend`; sum of recorded treatment prices).
- The docked chat panel, its resize handle and its collapsed state are gone; the page is one column again. `useRegisterChatPage` now only names the patient; `?chat=1` calls `requestChat` so the floating window opens on them.

### Floating dock (059) — `floating-dock/dock-context.tsx`, `chat-bubble.tsx`

- `ChatPageContext` is `{ patientId, patientName }`; `requestChat(thread)` opens the window on a thread (with a `seq` so the same patient can be re-requested). The bubble no longer hides while a page "docks" chat and the dock-back button is gone.

### Treatments tab (053, 069, 070) — `retention/recall-tasks-panel.tsx`, `patients/treatment-plan-card.tsx`

- Treatments badge carries a tooltip ("N upcoming bookings still need chasing (deposit, balance or consent)") and the Upcoming appointments items carry `data-qc="booking-chase-item"`, so badge = list.
- Recall tasks card: `id="recall"` anchor (scrolled to from the list pill via the `#recall` hash), `data-open` = recall groups + derived items, "No recall tasks yet." with the Retention sentence removed, an **Assign task** button for owners and managers (the Retention page's `StaffTaskHoverCard`, now with `openOnClick`), and the derived open items the list pill counts — forms awaiting signature (opens Documents) and an overdue treatment — listed underneath so the pill and the card agree.
- New **Treatment plan** card at the top of the tab (`id="plan"`, `data-qc="treatment-plan-card"`, `plan-progress` "N of M steps"): the patient's active plans from `listTreatmentPlans({ patient_id })` (new filter, production and demo), with phase, practitioner, progress bar (pink when late), next step and "Booked 28 Sep" / "Due …" label — the same rows the journey board and the dashboard journeys read.

### Who sees what (057, 124)

- Viewing a treatment form ("View record" in the history, "View" under Documents → Treatment records) needs `patients.edit_clinical`; receptionists see a "Recorded" status badge instead. Record treatment needs `treatments.record`. Archive needs manager. Medical history and From the patient tabs already follow the Phase 2 defaults.

### Tests

- `e2e/patients.spec.ts` — two record tests: the list pill count equals the record card's `data-open`, header buttons vs ⋯ menu items, lifetime spend, Treatments badge = chase items, Open chat opens the floating window (the fixture hides the dock; the test shows it for the check); the plan card's "N of M" equals the journey board card and the patient portal's "N of M milestones".
- `tests/metrics/consistency.test.ts`: the three UI-wired `todo`s are replaced by a pointer to these e2e assertions (16 asserted, 2 todo left for Phase 12's rendered spec).
- `e2e/offers.spec.ts`, `documents.spec.ts`, `consent-magic-link.spec.ts`: Send form / Send offer now opened from the ⋯ menu.
- `e2e/responsive/pages.ts`: `record-menu` state (core); `send-form` and `send-offer` open through the menu.

## Verification

| Check      | Result                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit       | 153 / 153; metrics 16 asserted + 2 todo                                                                                                                             |
| tsc        | 103 (baseline 103)                                                                                                                                                   |
| Validators | ok (`ListTreatmentPlans.patient_id`)                                                                                                                                 |
| Lint       | `patients.$id.tsx` −6, `chat-bubble.tsx` −1, others 0                                                                                                                |
| e2e        | patients 9 / 9, portal, treatment-workflow (bar the pre-existing `:63`), documents, consent-magic-link, offers (bar `:84`), comms, reminders (bar `:10`), unsubscribe, rbac, smoke: 54 + 15 passed |
| Responsive | patient-record on every device green after one fix (the "Open" link in the recall card became a 24 px target)                                                       |

## Captures

Record header with Record treatment, Open chat (1 unread) and ⋯; the menu (Send form, Send offer, Archive); the Treatment plan card; the floating chat window opened on Olivia. `/tmp/pf-p7-*.png` during the run.

## Notes

- "Lifetime spend" is the sum of recorded treatment prices, the same figure the retention page's "Lifetime value" column uses.
- `src/components/patient-chat-panel.tsx` had no importer left once the record dropped its docked panel (the team chat uses `staff-chat-panel.tsx`), so it is removed; `patient-chat-thread.tsx` stays, the floating window uses it.
