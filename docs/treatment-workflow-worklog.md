# Treatment workflow: arrival to complete — work log

Workstream 2 of the feedback round (feedback pages 7-8). Branch `e2e`, built on top of the corrections commit `92cb3ef`.

Decisions taken with the client before building: in-clinic consent is signed by the patient **on the clinic's device**, witnessed by the staff member logged in; the manual stage menu is **guided** (Waiting gated on consent, In treatment opens the form, Booked / Arrived / Aftercare / Complete / No show stay free).

## The rule, in one place

```
booked → arrived            reception marks arrival (card, schedule chip, dock)
arrived → waiting           automatic, once consent is signed or not required
arrived → arrived           consent outstanding: "Complete consent in clinic"
waiting → in_treatment      treatment form, page 1 "Start treatment"
in_treatment → aftercare    treatment form, page 2 "Move on to aftercare"
aftercare → complete        treatment form, page 3 "Complete treatment"
```

Reaching `waiting` raises a `patient_waiting` staff notification for the booking's practitioner (managers when unassigned). The bell and the dock open the form directly at `/patients/$id?treat=<appointmentId>`.

## Phase 0 — schema, rules, fixtures

| File | Change |
|---|---|
| `supabase/migrations/20260925000000_treatment_sessions.sql` | New `treatment_sessions` table: one form per appointment (`pre_checks`, `results`, `treatment_notes`, `visit_notes`, `aftercare_points`, `aftercare_extra`, `status started→treating→aftercare→complete`, timestamps, `treatment_id` set on completion). Staff manage; patients read their own completed rows; `clinic_isolation` restrictive. |
| `supabase/migrations/20260925000001_treatment_workflow_columns.sql` | `treatment_catalogue.aftercare_points text[]`, `treatments.appointment_id`, `treatment_photos.appointment_id`, `documents.witnessed_by`. |
| `src/integrations/supabase/types.ts` | Hand-maintained types for the table and the four columns. |
| `src/lib/auth/clinic-scope.server.ts` | `treatment_sessions` added to `CLINIC_SCOPED_TABLES` (50 tables, 41 scoped). |
| `src/lib/visit-stage.ts` | Pure rules: `consentState`, `consentReady`, `stageAfterArrival`, `manualStageOptions` (the guided menu), `canStartTreatment`, `STAGE_LABEL`, `PRE_TREATMENT_CHECKS`, `preCheckFlags`, `CONSENT_BODY_DEFAULT`. |
| `src/lib/aftercare-defaults.ts` | Category-keyed default aftercare points plus two general safety lines; `aftercarePointsFor()` prefers the catalogue's own list. |
| `tests/unit/visit-stage.test.ts` | 13 tests over the rules and defaults. |
| `src/lib/demo/data.ts` | Catalogue specs carry `aftercare` (Anti-Wrinkle, Chemical Peel, Laser set; others fall back). Today's cards obey the rule: 11:00 Lip Filler in-treatment now signed; 11:30 Anti-Wrinkle becomes *arrived, consent outstanding*; 13:00 Profhilo (Nadia's book) becomes *waiting*; 15:30 Chemical Peel moves to Nadia's book with consent signed. `arrived`/`waiting` bookings carry a realistic `updated_at`. `treatments.appointment_id` set wherever a treatment came from a booking. New `treatmentSessions` fixture: a draft at the right page for today's in-treatment and aftercare cards, a finished form behind today's completed ones. `DEMO_TODAY_CONSENT_TOKEN` on the 14:00 booking's pending consent for the magic-link test. `makeDocument` rows carry `witnessed_by`. |

## Phase A — arrival, consent, waiting (server)

| File | Change |
|---|---|
| `src/lib/visit-stage.server.ts` | `advanceToWaitingIfReady(db, {appointmentId | consentDocumentId})`: arrived + consent ready → `waiting`/`attended`, inserts `patient_waiting` notification (practitioner, else owners/managers). Works with a staff session, the clinic-scoped admin client and the raw service client. `consentStateOf(row)` reads the `documents(status)` + `treatment_catalogue(requires_consent)` joins. |
| `src/lib/visit-stage.demo.ts` | Twin over fixtures: `advanceToWaitingIfReadyDemo`, `demoConsentStateOf`. |
| `src/lib/clinic.functions.ts` — `updateAppointmentState` | `stage: "arrived"` runs the rule and returns the resolved stage. `stage: "waiting"` is treated as arrival plus the rule; `waiting`/`in_treatment` are refused with "Consent is outstanding — complete it in clinic first" when it is. |
| `src/lib/clinic.functions.ts` — `getAppointmentConsent`, `completeConsentInClinic` (new) | Read the form for the dialog; create the consent document if none was issued, sign it (`status signed`, `signed_name`, `signature_data`, `viewed_at`, `witnessed_by = ctx.userId`), audit, run the rule. Policy: `staff` / capability `documents.send`. |
| `src/lib/clinic.functions.ts` — `signDocument` | After the portal patient signs, runs the rule through `adminClient(context)` (patients cannot write appointments or staff notifications). |
| `src/lib/documents/access.server.ts`, `access.demo.ts` | The public magic-link signing runs the rule after a successful signature (errors logged, never fail the signing). |
| `src/lib/clinic.functions.ts` — `getDashboard`, `listAppointments` | Join `treatment_catalogue(requires_consent)`; every appointment row carries `consentState`. Demo `appointmentView` mirrors it. |
| `src/lib/validation/schemas.ts`, `src/lib/auth/policy.ts` | `GetAppointmentConsent`, `CompleteConsentInClinic`; POLICY entries. |
| `src/components/notification-bell.tsx` | `patient_waiting` opens `/patients/$id?treat=<appointment_id>`; on that kind the realtime handler (prod) and the 4s poll (demo) invalidate `["dashboard"]` and `["appointments"]` so the diary and dock refresh within seconds. |

## Phase B — diary and dock UI

| File | Change |
|---|---|
| `src/components/dashboard/today-snapshot.tsx` — `StageBadge` | Options from `manualStageOptions`: Waiting disabled with the reason inline; In treatment marked "opens the form" and navigates to `?treat=`; `consent` prop; `data-stage-option` hooks. |
| `src/routes/_authenticated/schedule.tsx` — `StageTracker` | Same guided menu on the diary chips. |
| `src/components/consent-in-clinic-dialog.tsx` (new) | Title and body of the consent, "read and understood" checkbox, typed-name signature (Caveat), witness line, `Sign and continue`; toast "Consent signed — {first} is now waiting". Shows the signature when already on file. |
| `src/components/dashboard/today-snapshot.tsx` — `TodayCard` | "since HH:MM" under the Waiting badge; the detail dialog gains a **Complete consent** strip when arrived-outstanding and **Start treatment / Continue treatment form** when waiting / in progress. Pointer capture on the strip now starts only once a drag is under way — capturing on every press had been retargeting the click to the strip, so a plain click never opened the card's dialog (pre-existing; found while wiring the entry point). |
| `src/components/arrival-alerts.tsx` | Three card kinds share the dock carousel: arrival prompts (as before), **consent** ("{first} has arrived — consent outstanding" → Complete consent / Undo arrival) for staff, and **waiting** ("{first} is waiting · since HH:MM" → Start treatment / Record) for the booking's practitioner, all for managers. `PHASE_ORDER` puts waiting on top. |
| `src/lib/arrival-alert-snooze.ts`, `src/components/floating-dock/alert-bubble.tsx` | Phase union and pill styles gain `consent` and `waiting`. |

## Phase C — the treatment form (server)

All six take `treatments.record` for writes, `staff` for reads; demo twins mirror each; 104 validators, 149 handlers.

| Function | What it does |
|---|---|
| `getTreatmentSession({appointment_id})` | Appointment (date, time, stage, practitioner, session N of M from the plan step), patient (allergies flagged, medication, conditions), consent (state, signed by, witnessed), `canStart`, the saved form draft, last five previous visit notes, last same-type treatment, aftercare points (catalogue or category defaults), the pre-check template, photos taken this visit, the plan step. |
| `startTreatment({appointment_id, pre_checks})` | Refuses unless `canStartTreatment`; upserts the session (`treating`); stage → `in_treatment`; audit. |
| `moveToAftercare({appointment_id, results, treatment_notes?, visit_notes?})` | Saves page 2; writes the visit note to `appointment_notes` now (shared `writeVisitNote` helper, factored out of `saveAppointmentNote`); stage → `aftercare`. |
| `completeTreatment({appointment_id, aftercare_points, aftercare_extra?})` | Inserts the `treatments` row (results as product/area/dose, treatment notes, price from the booking, `performed_at` = slot start, `next_due_at` from `interval_days`, `consent_document_id`, `appointment_id`, commission snapshot); session `complete` with `treatment_id`; re-points the visit's photos to the treatment; marks the plan step done (`setMilestoneStatus`, factored out of `updatePlanMilestone`, now also stamps `appointment_id`) with fallback to the active plan's current session step; stage → `complete`; `patients.last_visit_at`. Idempotent. |
| `saveTreatmentSessionDraft(...)` | Autosave of any page's fields; never changes stage; ignored once complete. |
| `getTreatmentRecord({treatment_id})` | Treatment + session + photos (signed URLs) + consent for the viewer. |
| `addPhoto` | Accepts `appointment_id` so photos taken during the visit exist before the treatment row. |
| `getPatient` | Treatments carry `hasRecord`; `todayVisit` (id, stage, consent state) for the record page. |
| `getPortalTimeline` | The completed-step card's visit note is the form's `visit_notes` (patient-readable via the new RLS policy), falling back to the treatment note. |

## Phase D — the treatment form (UI)

| File | Change |
|---|---|
| `src/routes/_authenticated/patients.$id.tsx` | `?treat=` and `?record=` search params open the form / the record viewer (dock, bell, diary, TodayCard all link here). Treatments tab: a **Today's visit** card with Start / Continue treatment form (disabled with a reason while consent is outstanding); **View record** on rows from the form. Documents tab: a **Treatment records** list. |
| `src/components/treatment-form-dialog.tsx` (new) | Large dialog, three-step header that follows the saved form's status. Page 1: patient details with allergies flagged, treatment details with consent pill and plan step, last same-type treatment, previous visit notes, five standard pre-treatment checks (Yes / No / N/A; a No needs a note) — Start treatment disabled until all are answered and consent is ready. Page 2: results (area, product, dose pre-filled from the last same-type treatment), treatment notes and visit notes on the notes editor, before/after upload against the appointment — Move on to aftercare. Page 3: the treatment's aftercare points as a tick list, custom line, "anything else said" — Complete treatment. Done state with View record / Back to diary / Close. Debounced autosave reads the latest values through a ref so a late flush can never write stale fields; page mutations cancel any pending draft. |
| `src/components/treatment-record-view.tsx` (new) | The record as a document: header, consent, results, pre-checks, both notes, photos, aftercare read out, timestamps; Print button with `print:` styles. |
| `src/components/treatment-catalogue-settings.tsx` | Aftercare points editor (one per line) per catalogue item; `saveCatalogueItem` accepts `aftercare_points` (omitting it leaves the column alone). |

## Phase E — parity, tests, ship

- Prod and demo export the same 149 server functions; `check:policy`, `check:validators`, `check:tenancy` green; 102 unit tests pass; tsc delta against the branch point is zero.
- `e2e/treatment-workflow.spec.ts` (5 serial tests): arrival with signed consent → Waiting automatically, bell nudge and dock card for the practitioner; arrival without consent stays Arrived, guided menu (Waiting disabled with reason, In treatment "opens the form"), consent signed in clinic with witness → Waiting, signature on the Documents tab; magic-link signing via `POST /api/documents/access/:token` → Waiting; the full three-page run from the bell nudge with the stage read on the form after each page, a "No" pre-check needing a note, catalogue aftercare points, the record viewer, Treatments / Visit notes / Documents fan-out, diary card Complete, dock card gone; a second run for the portal patient whose completed session appears on the patient timeline (Treatment details, Consent pill, visit note) and the dashboard journey card.
- Full Playwright: 120 passed; `reminders.spec.ts` fails identically at the branch point (pre-existing, unrelated).

## Notes for the live database

Apply `20260925000000_treatment_sessions.sql` and `20260925000001_treatment_workflow_columns.sql`. Existing catalogue rows get an empty `aftercare_points` and fall back to the category defaults until edited in Settings.
