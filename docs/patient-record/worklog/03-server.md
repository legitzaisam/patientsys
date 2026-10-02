# Phase 3: server functions

Branch `e2e_exp`, on top of `ab386d9`. 2 Oct 2026. Five new handlers and one extended read, each in `src/lib/clinic.functions.ts` with its twin in `src/lib/clinic.functions.demo.ts`, a `POLICY` row in `src/lib/auth/policy.ts`, `parseInput(schemas.X)` and an `audit()` on every write. `check:policy` 191 → **196 handlers**, all declared and calling `authorize()`; `check:validators` back to only the two known `saveAppointment` findings; `check:tenancy` 62 tables unchanged; `tsc` no new errors; per-hunk eslint 0 (the new code uses narrow local row types instead of the surrounding `any`).

### pr-p3-01-plan-detail

- `getPatientPlanDetail({ patient_id })` → `null` or `{ plan, roadmap, milestoneAppointmentIds }`. Finds the plan exactly as the portal does (`portalPlan`: active or paused, else newest), then builds `roadmap` with the same `portal.stepExtrasFor` + `portal.roadmapFor` the patient's Timeline uses (`getPortalTimeline`, L4043–4145), so the two views cannot drift. Differences from the portal read: every photo (not only `visible_to_patient`), and each checklist item gains `doneAt` / `doneByKind` from the Phase 2 columns. `plan` carries name, strapline, phase, status, `startedAt`, `durationDays`, `practitionerId` + `practitionerName` (one `profiles` lookup), and `milestonesDone/Total/completion`. `milestoneAppointmentIds` is what `onPlanAppointmentIds` consumes for "Not on skin plan".
- POLICY `{ kind: "capability", key: "view.patients.treatments" }`: the roadmap is the Treatments tab's content, so it follows that tab's grant.
- Demo twin reads `treatmentPlans` / `planMilestones` / `planMilestoneChecklist` / `appointments` / `treatments` / `treatmentSessions` / `photos` from the fixtures the same way `getPortalTimeline`'s twin does (L3344–3400).

### pr-p3-02-get-patient

- `getPatient` (prod L1246+, demo L1089+) returns, in addition to everything it did:
  - `upcoming[]` — **every** future non-cancelled booking (`id, startsAt, treatmentName, practitionerName, paymentStatus, price, consentSigned, issues, bookingNote`). `bookingChase` is now derived from it (`issues.length || bookingNote`), so its meaning and the Treatments badge count are unchanged. The booking query selects `price` too.
  - `todayVisit.paymentStatus`, `todayVisit.price`, `todayVisit.endsAt` — the hero's "Balance £295" row and "60 min". The today query selects `ends_at, payment_status, price`.
  - `journal[].attachments` — `journal_attachments` rows with signed `patient-photos` URLs, the same signing `getPortalJournal` does (L4164–4175); demo returns `storage_path` as the URL like the rest of the demo.
  - `pendingHistory[]` — `history` rows with `source = "patient"` and no `reviewed_at`.
  - `checkins[].reviewed_at` / `reviewed_by` arrive through the existing `select("*")`.

### pr-p3-03-review-checkin

- `reviewRecoveryCheckin({ patient_id, checkin_date })` stamps `reviewed_by/at` on the (patient, day) row — the unique key of `recovery_checkins`. Audit `review` / `recovery_checkin`. POLICY `treatments.record`, the same clinical capability as `reviewHistory` (front desk does not hold it).

### pr-p3-04-accept-history

- `acceptHistoryUpdate({ id, patient_id })` reads the version's `data`, copies non-empty `allergies` / `medications` / `conditions` onto the `patients` row (`updated_at` bumped), then stamps the version reviewed. Returns `{ ok, applied: ["allergies", ...] }` so the UI can say what changed. Audit `accept` / `medical_history` with the field list. `reviewHistory` is untouched and still means "seen, not merged".

### pr-p3-05-clinic-tick

- `setMilestoneChecklistItem({ id, done })` (staff): ticks or clears any item, including `clinic_owned`, writing `done_by_kind = "clinic"`, `done_by = userId`. Audit `plan_checklist.update`.
- `toggleChecklistItem` (patient, existing) now also writes `done_by_kind = "patient"` and `done_by` so the record can show "patient · 28 Sep". Its refusal of clinic-owned items is unchanged.

### pr-p3-06-edit-step

- `updatePlanMilestoneDetails({ id, title, due_date?, detail?, status? })`: writes title/due date/detail; when `status` differs from the current one it goes through `setMilestoneStatus(..., fields)` so the next step is promoted and the plan closes exactly as the treatment form does. Audit `plan_milestone.edit`. POLICY `treatments.record`, like `updatePlanMilestone`.

### pr-p3-07-guards

- POLICY rows added: `acceptHistoryUpdate`, `reviewRecoveryCheckin` (clinical record block); `getPatientPlanDetail`, `updatePlanMilestoneDetails`, `setMilestoneChecklistItem` (treatment plans block), each with a one-line reason where the choice is not obvious.
- Unit suite 272 passed, 11 known failures. No UI consumes the new fields yet; Phases 6–9 do.
