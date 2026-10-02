# Phase 7: the Overview tab

Branch `e2e_exp`, on top of `2f229c2`. 2 Oct 2026. Five cards under `src/components/patients/record/` (plus the reworked `src/components/retention/patient-tasks-panel.tsx`), wired into `src/routes/_authenticated/patients.$id.tsx`; the interim Overview from Phase 6 is replaced by the hand-off's layout (`Claude outputs/export/mockup-screenshots/01-…`, `02-…`). Every helper the cards lean on was written and unit-tested in Phase 1 (`src/lib/patients/record-overview.ts`); the data arrives from Phase 3's `getPatient` (payment, `upcoming`, `pendingHistory`, journal attachments) and `getPatientPlanDetail`.

### pr-p7-01-ready-to-treat

- `ready-to-treat-card.tsx`: `glass-card` hero, `sm:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]`. Left column (`data-qc="today-visit"`) on the gold wash: TODAY'S VISIT · 44px `clockTime` · treatment · clinician · duration (from `endsAt − startsAt`). With no visit today it reads NEXT VISIT with the day and time, or NO VISIT TODAY / "Nothing in the diary".
- Right column: "Ready to treat?", "n of m clear · items synced from the patient portal are marked", 140px progress bar, then the readiness rows in an `auto-fit minmax(min(100%,400px),1fr)` grid. Rows come from `readinessItems()` (Phase 1): check-in flagged, history changed, balance, today's checklist items, consent, before photos; tone-washed, no accent rails. Rows with a `portal` / `history` / `consent` link are whole-row targets (`role="button"`, Enter/Space) with a text-only link that underlines on hover; `data-qc="readiness-item"` with `data-kind` / `data-tone`.
- Take payment is the shared `PaymentStatusChip` (Phase 5) on today's appointment, triggered from the row's text link, `align="end"`.
- Footer: a note ("You can still start the form. Open items carry into it." or "Consent is outstanding; the form opens once it is signed.") and **Continue treatment form** / **Start treatment** (`data-qc="open-treatment-form"`, disabled while consent is outstanding), which opens the existing `TreatmentFormDialog` for today's visit. Shown only when `treatments.record` is granted.

### pr-p7-02-skin-plan-card

- `skin-plan-summary-card.tsx`, fed by `["patient-plan", id]` → `getPatientPlanDetail`. Header "Skin plan" with "Month n of m"; plan name, strapline, phase (`JOURNEY_PHASE_META`) · clinician.
- Month bar: one segment per step, grouped by month with `gridTemplateColumns` proportional to the step count; done = success, current = accent with a soft glow ring, upcoming = grey; month labels beneath (`data-qc="skin-plan-months"`).
- **Up next** box (`skin-plan-next`): STEP N OF M, title, "Due Sun 4 Oct · in 2 days", **Not booked** chip (`skin-plan-not-booked`) when a session step has no booking, **Book** (`skin-plan-book`) → `QuickAddAppointment` with `milestoneId` preselected; the dialog's title reads "Book this step", the practitioner defaults to the plan's clinician, and closing it invalidates `["patient-plan", id]` and the patient.
- Footer: "Checklist n of m" · Open roadmap → (`skin-plan-roadmap`) → `changeTab("treatments")`. No-plan state: footer "No plan yet" and "No active skin plan. Start one from the journey board…" (plan creation stays on the journey board and Treatments).

### pr-p7-03-upcoming-card

- `upcoming-card.tsx` from `data.upcoming` (every future booking, not just the chase list). Sky `dateBlock` (OCT / 2), treatment, "Fri · 10:15 · Dr Nadia Rahman", chips from `upcomingIssueChips` (Balance due / Deposit unpaid / Consent due) and a dashed **Not on skin plan** when the id is not in `onPlanAppointmentIds(milestones)`; booking notes in a muted line. Meta "n booked · n on plan" from `upcomingMeta`.
- Rows keep the dashboard's hook: `data-qc="booking-chase-item"` when the booking has issues, `upcoming-row` otherwise, plus `data-on-plan`. When `?chase=1` is set, the card's subtitle switches to "These visits still need chasing…" and the route scrolls it into view (Phase 6).
- Footer: **Send consent forms** (`upcoming-send-consent`) → the existing Send to patient dialog, preset to kind **Consent** and titled "<today's treatment> — consent form" (`docPreset` state; the dialog is keyed on the preset so the defaults apply) · Open diary → (`upcoming-open-diary`, `Link` to `/schedule`).

### pr-p7-04-tasks-card

- `patient-tasks-panel.tsx` rewritten as `TasksRecallsCard` (still exported as `PatientTasksPanel`): `RecordCard` tone warning, "Tasks and recalls", meta "n open" / "All done" (`data-qc="patient-tasks"` with `data-open`).
- Each open row (`patient-task`, `data-status`) has a tick circle (`patient-task-tick`, aria "Mark … as handled") that calls `useTaskActions().complete(t, "handled", "Handled")`: strike-through + 55% opacity straight away, toast "Grace: handled. Removed from the dashboard's Attention needed." with **Undo**. The local tick now stays on until the refetch after the server call lands (a `settled` ref cleared on the next `data` change) instead of clearing in `finally()`, which briefly un-struck the row before the list refreshed; a failed call clears it immediately because `run()` resolves `null` after rolling back. Undo refetches again, so the row comes back open and un-struck.
- Type chips via `TYPE_TONE` (Chase booking purple, Recall sky, Plan support, Aftercare…), assignee or "Auto-created from 27 Sept" and the due phrase; manual tasks show their context line. Title links to `/tasks?task=<id>`.
- Footer: **+ Assign task** (`patient-tasks-assign`, `AssignTaskDialog`) · Open Tasks → (`patient-tasks-open`, `/tasks`). `#tasks` / `#recall` anchors and the "Recently closed" details are kept.

### pr-p7-05-journal-card

- `latest-journal-card.tsx`: "Latest journal", meta "Shared by patient"; the latest entry in a pink panel (`journal-latest`) with the Day chip from `journalDayLabel` (entry title "Day 4" wins, otherwise `dayAfterTreatment`), "Tue 29 Sep · 19:20", the quoted body and photo thumbs from the signed `attachments`; the previous entry as one ellipsised line (`journal-previous`); empty state "Nothing shared yet".
- Footer: **Reply in chat** (`journal-reply`) → the route's `requestChat()` (opens the patient chat panel) · All entries → (`journal-all`) → `changeTab("portal")`.

### pr-p7-06-grid

- Route: `ReadyToTreatCard` full width, then `<div className="grid grid-cols-1 gap-4 [grid-auto-rows:1fr] lg:grid-cols-2">` holding Skin plan, Upcoming (wrapped in `#upcoming` with `bookingsRef`), Tasks and recalls, Latest journal. `grid-cols-1 lg:grid-cols-2` instead of `auto-fit minmax(420px)` because the latter produced three columns at 1440 and broke the 2×2 of the mockup; equal row heights come from `grid-auto-rows: 1fr` and each `RecordCard`'s `mt-auto` footer.
- Derived in the route after the data guard: `badges`, `todayVisit`, `upcoming`, `onPlanIds`, `nextStep`, `nextStepChecklist`, `readiness`, `lastPractitionerId`; `now` is memoised once per mount.

### pr-p7-07-worklog-07

- Captures in `captures/07-overview/`: `owner--ipad-mini--overview.png`, `owner--ipad-pro-landscape--overview.png` (WebKit), `owner--laptop-1440--overview.png` (Chromium), full page via `scripts/capture-patient-record.mjs --out … --roles owner --tabs overview`. Against `01-…`: gold visit column, seven readiness rows in two tones per state, Continue treatment form bottom-right; the 2×2 below with the month bar, Up next box, sky date blocks with chips, tick circles with type chips, pink journal panel with thumbs; footers sit on the card's bottom edge at equal heights. No horizontal overflow reported on either iPad.
- Actions exercised on the rebuilt local stack (8199) for Grace as owner: Review on the check-in row → `?tab=portal`; Review on the history row → `?tab=history`; Take payment hover → payment card with Deposit £88.50 / Full amount £295.00 and Email / Text; Continue treatment form → treatment form dialog "Microneedling with PRP · Grace Adeyemi … Session 3 of 3"; Book → "Book this step" with Dr Nadia Rahman preselected; Open roadmap → `?tab=treatments` with the plan card; Send consent forms → Send to patient preset to Consent, "Microneedling with PRP — consent form"; tick on "Chase to book microneedling session 2" → struck at once, moves to Recently closed with "2 open", toast with Undo; Undo → row open again, "3 open"; Reply in chat → chat panel "Private messages with this patient"; All entries → `?tab=portal`; Open diary `/schedule`, Open Tasks `/tasks`, task titles `/tasks?task=<id>`.
- Gates: `tsc` no new errors against the baseline; per-hunk eslint 0 on the route and the new components (the four remaining findings are on the untouched Treatment history markup that Phase 8 removes); `tests/unit/record-overview.test.ts` 17 passed; suite otherwise unchanged.
