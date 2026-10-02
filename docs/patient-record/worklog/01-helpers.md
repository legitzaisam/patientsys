# Phase 1: pure helpers for the record

Branch `e2e_exp`, on top of `f891c01`. 2 Oct 2026. Everything the three redesigned tabs compute lives in one module with no Supabase types, so the production handler, the demo twin and the components share one set of rules, and each rule has a unit test. `tests/unit/record-overview.test.ts` — 16 tests.

### pr-p1-01-readiness

- `src/lib/patients/record-overview.ts` (new) → `readinessItems({ visit, checkins, history, checklist, beforePhotos, now })` returns `{ items, clear, total }`. Rows, most urgent first (`alert` → `review` → `todo` → `done`):
  - check-in: `alert` "Recovery check-in flagged" with "Redness severe, 30 Sep · portal" and a `portal` link while any check-in reads moderate or worse and is unreviewed; `done` "Recovery check-ins clear" when there are check-ins but none open; nothing when the patient has never checked in.
  - medical history: `review` "Medical history changed" with the patient's words ("Lidocaine allergy, Tretinoin 0.025% · portal") and a `history` link while a `source = patient` version is unreviewed; `done` "Medical history reviewed" otherwise (when any version exists).
  - money (today's visit only): `todo` "Balance £295 · Not paid" (`payment` link) when unpaid; after a 30% deposit, "Balance £206.50 · Deposit paid"; `done` "Paid £295" when paid; nothing for refunded or free visits.
  - consent (today's visit only): `done` "Consent signed · <treatment> · <date>", or `review` "Consent due" with a `consent` link (opens the Send form dialog on the consent kind) when outstanding; nothing when the catalogue says consent is not required.
  - the current step's **patient** checklist items, one row each: `done` "Ticked by patient · portal" or `todo` "Not ticked yet · portal". Clinic-owned items stay on Step details.
  - photos: `done` "Before photos on file · 6 photos · 26 Sep", or `todo` "No before photos" when there is a visit today and none.
- `ReadinessLink` is `portal | history | payment | consent | null`: the hero maps each to a tab switch, the payment chip, or the consent sender.

### pr-p1-02-plan-summary

- `planMonths(roadmap)` → per-month `done | current | upcoming` tones for the split bar and `current`/`total` for "Month 2 of 3" (the month holding the `current` step, else the first month with anything open).
- `upNextStep(roadmap)` → `{ id, index, total, title, dueDate, booked, bookedAt, needsBooking, checklistDone, checklistTotal }`, numbered across every month ("STEP 6 OF 8"); `null` when the plan is finished.
- `stepChip(step)` → Completed / Skipped / In progress / Upcoming with its tone; `stepNeedsBooking(step)` is true for an unfinished `session` step with no `bookedAt`/`appointment` — "Not booked" is derived, exactly as the patient's Timeline does it (`my-record.plan.timeline.tsx` L315–321), never a milestone status.
- Input is the portal's `roadmapFor()` output (`RoadmapMonthLike`), so Overview and Treatments read the same roadmap the patient sees.

### pr-p1-03-on-plan

- `onPlanAppointmentIds(milestones)` → the `appointment_id`s plan steps point at. `upcomingMeta(upcoming, ids)` → "2 booked · 0 on plan"; `upcomingIssueChips(a)` → Deposit unpaid / Balance due (`alert`) and Consent due (`review`), the same wording `getPatient.bookingChase` already uses.

### pr-p1-04-checkin-helpers

- `isUrgentCheckin(c)` = `checkinNeedsAttention(c) && !c.reviewed_at` (threshold 34 from `src/lib/portal/shape.ts`); `checkinStatus(c)` → `open | reviewed | none` with `CHECKIN_STATUS_LABEL` Open / Reviewed / No flag; `worstReading(c)` → "Redness severe".
- `dayAfterTreatment(date, treatments)` → `{ days, treatment, label: "day 4 after Microneedling with PRP" }` from the latest treatment on or before the check-in; `null` before any treatment.

### pr-p1-05-history-chips

- `treatmentFormChips(t, documents, photos)` → `✓ Treatment record` (treatment_sessions row), `✓ Consent` (a signed consent document linked by `treatment_id` or `treatments.consent_document_id`), `✓ Aftercare sent` (an aftercare document that left draft), `N photos` (photos linked to the treatment or taken the same day), and the pink `Depth not recorded` when a microneedling/dermapen treatment has no `N.Nmm` in its dose.
- `treatmentDetailLine(t)` → "Full face · Autologous PRP · 1.5mm depth · £295 · recall 25/12/2026". `historyFilter(rows, "all" | "prp" | "missing", chipsFor)`: PRP matches name or product; missing = any alert chip or no consent chip.

### pr-p1-06-badges

- `recordTabBadges({ bookingChase, checkins, history })` → `{ treatments, portal, history }`: bookings to chase (unchanged), unreviewed urgent check-ins, unreviewed patient versions. Tabs hide a badge at 0.
- Date wording helpers used by every card: `shortDate` "30 Sep", `shortDay` "Sun 4 Oct", `longDate` "4 Oct 2026", `dateBlock` `{ OCT, 20 }`, `clockTime`, `money`, `relativeDays` ("in 3 days", "tomorrow", "2 days ago"). Months are spelled by hand because newer ICU data writes en-GB September as "Sept" and the mockup (and the rest of the record) uses three letters.
