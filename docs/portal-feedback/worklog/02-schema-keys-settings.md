# Phase 2: schema, permission keys, Settings surfaces, pagination component

Branch `e2e_live`, on top of `3dc8c7e`. 27 Sep 2026.

## Scope

Index bullets 024 (data), 028 (data + Settings tab), 029, 044 (data), 055 (component), 104 and 145 (key), 113 (data), 123, 124 (key), 125, 131 (data), 133–137 (Settings), 141. Everything later phases depend on: nullable migrations with demo parity, the two capability keys and the defaults review, the audit trail on grants, the two policy fixes, the pagination component, and the Settings tabs.

## Changes

### Migrations (all additive, `IF NOT EXISTS`, defaults or nullable)

| File                                                     | Adds                                                                                                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260929000000_clinic_deposit_rules.sql`                | `clinics.deposit_lead_days` (3, 0–30), `clinics.deposit_percent` (30, 0–100)                                                                                                                                     |
| `20260929000100_appointment_details_incomplete.sql`      | `appointments.details_incomplete boolean default false`                                                                                                                                                          |
| `20260929000200_recall_task_due_at.sql`                  | `recall_tasks.due_at timestamptz`, backfilled to `created_at + 7 days`                                                                                                                                           |
| `20260929000300_profile_compliance_fields.sql`           | `profiles.registration_expiry date`, `insurance_provider text`, `insurance_expiry date`, `qualifications text`                                                                                                   |
| `20260929000400_capability_keys_commission_clinical.sql` | seeds `reports.commission` (all off) and `patients.edit_clinical` (manager, practitioner on; receptionist off) per clinic; applies the defaults review to rows nobody has changed by hand (`updated_by IS NULL`) |
| `20260929000500_offer_rules.sql`                         | `offer_templates.applies_to_catalogue_ids uuid[]`, `one_per_patient`, `no_stacking` (both default true)                                                                                                          |

`src/integrations/supabase/types.ts` is hand-maintained and carries every new column on Row / Insert / Update.

### Deposit rules (028, 137)

- `getClinicDetails` returns the two rules; new `updateDepositRules` (policy `capability settings.treatments`, audited) in production and demo; `schemas.UpdateDepositRules`; demo clinic row seeded 3 / 30.
- New `src/components/payments-deposits-settings.tsx`: the Payments and deposits card with both fields, unsaved-changes guard, and a save that also refreshes the dashboard query. The dashboard's copy and urgency read these in Phases 4 and 8.

### Details incomplete (044)

- `schemas.SaveAppointment.details_incomplete` (optional boolean); both `saveAppointment` handlers write `data.details_incomplete ?? false`, so a save from the full booking dialog clears it. `quick-add-appointment.tsx` sends `true`. Demo `makeAppointment` rows default to `false`. The chip and the Needs-action type land in Phase 5.

### Recall task due date (024)

- `schemas.CreateRecallTask.due_at` (optional); both `createRecallTask` handlers default it to a week from now. `staff-task-hovercard.tsx` (Retention → Send recall task) and `no-show-followup-dialog.tsx` gain a "Due by" date field defaulting to +7 days. The five demo seed tasks carry `due_at = created_at + 7 days`. `listOpenRecallTasks` selects `*`, so the dashboard receives it; the My tasks row shows it in Phase 8.

### Profile compliance fields (113)

- `schemas.SaveMyProfile` and `UpdateStaffMember` accept `registrationExpiry`, `insuranceProvider`, `insuranceExpiry`, `qualifications` (new `optionalDateOnly` primitive, YYYY-MM-DD or empty); both handlers write them in production and demo; the identity profile select includes them. Demo profiles seeded: Dr Osei (GMC, insurance expiring in 140 days), Dr Rahman (registration expiring in 45 days), Dr Whitfield (insurance expiring in 28 days), Dr Cho; receptionist and admin null. The dropdown, expiry inputs and owner reminder are Phase 10's UI.

### Capability keys and defaults (104, 123, 124, 145)

- `reports.commission` ("Commission and payouts", Reports group): off for every role by default; the owner always holds it. Catalogue node `performance-commission` under Performance. Phase 10 gates the money behind it.
- `patients.edit_clinical` ("Edit clinical record", Clinical record group): manager and practitioner on, receptionist off. Catalogue node `patient-edit-clinical` under the patient record. Phase 7 gates the clinical edit actions. Note: the plan named this `patients.edit`; that key already exists and also covers creating patients and keeping contact details, which reception must keep, so the clinical edit is a separate key and the existing key's description now says "contact details" only.
- Defaults review in `access-catalogue.ts` and the demo `rolePermissions`: Receptionist loses Insights (page and both tabs), Treatments & colours, Medical history and From the patient; Practitioner gains Insights; Manager gains Design and automate offers. `reports.performance` description no longer promises the commission split; `team.view` description matches its toggle.
- Unit tests `access-catalogue` and `permissions` pass against the new defaults without changes (they compare the catalogue with the demo rows).

### Permission audit (125)

- Production already wrote `audit_log` on `access.update` and stamped `updated_by` / `updated_at`; `listRolePermissions` now also returns `changes` (who, when, per role and key) with names from `profiles`. Demo: `setRolePermission` stamps the row and appends to a new `db.auditLog`; seed grants are unattributed apart from two owner changes (receptionist Send documents, manager Design and automate offers) so the grid has something to show.
- `access-control-settings.tsx` (Team → Staff access): each key shows "Receptionist changed by Dr Amara Osei · 15 Sept 2026, 10:15" for its most recent change, and each switch carries the same as a tooltip.

### Policy fixes (029, 141)

- `POLICY.listAccountsMissingEmail` `owner` → `manager` and `archivePatient` `owner` → `manager`; the demo twins call a new `requireManager()`. `tests/unit/policy-scope.test.ts` updated (`setRolePermission` is `accessAdmin` since the access-catalogue pull, `archivePatient` is `manager`), which also clears the one pre-existing unit failure.

### Pagination component and Settings (055, 133–136)

- New `src/components/pagination-bar.tsx`: `usePagination(items, pageSize)` and `PaginationBar` (first / previous / next / last, "Showing a–b of N", hidden when one page). First consumer: the Treatments list in Settings at 10 per page, with archived treatments behind "Show archived (N)".
- `settings.tsx` is tabbed (Clinic, Treatments, Products, Payments and deposits), the tab in the URL (`?tab=`). Integrations moved to `/access` in Phase 1, so it is not a tab here.
- Reset-colour icon shows only when a treatment's colour differs from its default; retail products' Archive / Restore is a text button like treatments.

### Offer rules schema (131)

- `schemas.SaveOfferTemplate` accepts the three rule fields; both handlers persist them with defaults; `OfferTemplateRow` and the editor's form state carry them through a save so an edit never resets them. Editor fields and enforcement in `offers/send.ts` are Phase 11.

## Verification

| Check                                                                | Result                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `check:policy`                                                       | ok, 162 handlers                                                                                  |
| `check:validators`                                                   | ok, 116 validators, production and demo in step                                                   |
| `check:tenancy`                                                      | ok, 52 tables                                                                                     |
| Unit                                                                 | 133/133 (policy-scope fixed)                                                                      |
| `tsc --noEmit`                                                       | 103, identical to baseline (one pre-existing message now lists the new profile columns)           |
| E2E: rbac, team, smoke, offers, patients, comms, schedule, retention | 58 passed, 1 failed (`offers:84`, pre-existing)                                                   |
| Visual                                                               | Settings tabs and Payments and deposits; Team grid with the new keys and the change note, at 1440 |

E2E expectations changed and why:

- `e2e/rbac.spec.ts`: practitioner sees Insights and can open `/insights`; receptionist no longer sees Insights and `/insights` bounces (defaults review).
- `e2e/smoke.spec.ts`: `/insights` moved from the receptionist's pages to the practitioner's.
- `e2e/responsive/pages.ts`: `insights` roles `owner, practitioner, admin`.
- `tests/unit/policy-scope.test.ts`: as above.

## Captures

Ad-hoc 1440 screenshots only; the review pack arrives in Phase 12.

## Notes

- The two `UPDATE` statements in the defaults migration touch only grants nobody has changed by hand (`updated_by IS NULL`); an owner's deliberate choice survives.
- `patients.edit_clinical` replaces the plan's reuse of `patients.edit` (see above).
- The Settings "Integrations" tab in the plan does not exist because the card moved to the software-admin surface in Phase 1.
