# Phase 0: baseline for the patient record redesign

Branch `e2e_exp`, on top of `b68182e`. 2 Oct 2026. Design hand-off: `Claude outputs/export/` (README, `source/Patient Record.dc.html`, `source/PatientHeader.dc.html`, `mockup-screenshots/01–06`). Plan: `.cursor/plans/patient_record_redesign_2aa6eeeb.plan.md`. Example patient throughout: Grace Adeyemi (`patients[9]` in the demo fixtures, reference AV-1263).

### pr-p0-01-captures-before

- `scripts/capture-patient-record.mjs` (new): finds the patient by name through the records list (`[data-qc="records-name"]` href), opens the record as each role, clicks every `role="tab"` and shoots it full-height. WebKit at iPad Mini portrait and iPad Pro 11 landscape, Chromium at 1440×900. Flags horizontal overflow (`scrollWidth > innerWidth`) and page errors. Flags: `--out`, `--base`, `--patient`, `--roles`, `--tabs`.
- Captures: [`captures/00-before/`](../captures/00-before/) — `owner--{ipad-mini,ipad-pro-landscape,laptop-1440}--{treatments,photos,documents,history,portal,contact}.png` (18 files, no overflow, no page errors). These are the "before" for every later phase's side-by-side.

### pr-p0-02-selector-inventory

What the suites assert on the record today, and what happens to each hook in the redesign:

| Hook | Where asserted | Decision |
| --- | --- | --- |
| `role=tab` by label ("Before and after", "Documents", "Medical history", "Contact", "Treatments", "From the patient") | `e2e/patients.spec.ts:33–46`, `offers.spec.ts` (Contact ×4), `patient-portal/sync.spec.ts:153`, `responsive/pages.ts` `recordTab(...)`, `responsive/interactions.spec.ts:383` | Labels unchanged; "Overview" is added first and becomes the default |
| `patient-tasks` (`data-open`), `patient-task` (`data-status`) | `patients.spec.ts:66–70, 279` — reached by clicking the **Treatments** tab | Moves to the Overview *Tasks and recalls* card; keeps both hooks. The spec's tab click changes to Overview (Phase 10) |
| `treatments-badge` (`title=/still need/`) + `booking-chase-item` count | `patients.spec.ts:89–94` | Badge stays on Treatments (count of bookings to chase). Chase rows move to the Overview *Upcoming* card; `booking-chase-item` stays on the rows that carry issues so the count still matches |
| `today-visit`, `open-treatment-form` | `responsive/pages.ts:398` (`treatmentForm` state), captures | Hero moves to Overview as `ReadyToTreatCard`; `open-treatment-form` is the **Continue treatment form** button. `today-visit` kept on the hero |
| `treatment-plan-card`, `plan-progress`, `plan-step`, `plan-book`, `plan-booking-note`, `plan-link` | `patients.spec.ts:114, 254–279` (`?tab=treatments`) | `plan-progress`/`plan-book`/`plan-step`/`plan-booking-note` live on the Treatments roadmap (`treatment-plan-card` id kept on the roadmap card, `#plan` anchor kept). The Overview summary card gets its own hooks (`skin-plan-card`, `skin-plan-book`) |
| `view-treatment-record`, `treatment-records` | `patients.spec.ts` | Kept on the new history rows |
| `record-more`, `menu-send-form`, `send-offer-open`, `open-chat`, `open-chat-unread`, `record-visits`, `record-lifetime-spend`, `menu-archive`, `menu-restore` | header checks in `patients.spec.ts:72–86`, `offers.spec.ts`, `responsive/pages.ts` | Header unchanged |
| `patient-offers`, `patient-offer-row` | `offers.spec.ts` | Contact tab unchanged |

Deep links into the record (callers to revisit in Phase 6): `attention-list.tsx` → `?tab=treatments&chase=1`; `treatment-journeys.tsx` → `tab: treatments`, `hash: plan`; `records-tab.tsx` → `tab: photos`; `offer-send-history.tsx`, `notification-bell.tsx` → `tab: contact` (+ `chat`, `treat`); `unsubscribe.spec.ts` → `?tab=contact`.

### pr-p0-03-worklog-00 — gaps the mockup needs, confirmed against the code

| Mockup needs | Today | Phase |
| --- | --- | --- |
| Overview tab, default | Six tabs, default `treatments`; tab clicks do not write `?tab=` | 6 |
| Ready to treat: consent, payment, unreviewed check-ins, pending medical update, patient checklist, photos | `getPatient.todayVisit` has `consentState` but no payment/price; no plan checklist on the clinic side | 1, 3 |
| Skin plan card + roadmap + step details "same as the patient's Timeline" | Portal has `roadmapFor`/`stepExtrasFor` (`src/lib/portal/shape.ts`); clinic has only `listTreatmentPlans` (board summary, no checklist) | 3 |
| Checklist attribution ("patient · 28 Sep", "You can tick") | `plan_milestone_checklist` has `done_at`, `clinic_owned`, no who-ticked; `toggleChecklistItem` refuses `clinic_owned` | 2, 3 |
| Upcoming with "Not on skin plan" | `bookingChase` only returns rows with issues; milestone `appointment_id` not exposed | 3 |
| Urgent check-ins "stay until marked reviewed" | `recovery_checkins` has no `reviewed_at`; the badge is derived from readings only | 2, 3 |
| Journal photo thumbnails | `getPatient.journal` has no attachments (portal `getPortalJournal` does, L4164) | 3 |
| Accept into record | `reviewHistory` stamps `reviewed_at` only; `patients.allergies/medications/conditions` never merge | 3 |
| Edit step | `updatePlanMilestone` changes status only | 3 |
| Take payment on the record | `PaymentStatusChip` lives inside `schedule.tsx` L1087–1309 | 5 |
| Grace's data as pictured | Portal fixtures (journal, check-ins) are seeded for Olivia only | 4 |
