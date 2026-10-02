# Phase 2: schema, permissions and validators

Branch `e2e_exp`, on top of `0fbbcd2`. 2 Oct 2026. Everything the server functions in Phase 3 need to exist first: two columns for review and attribution, one permission for the new tab, five zod schemas.

### pr-p2-01-migration

- `supabase/migrations/20261004000100_record_overview.sql` (new):
  - `recovery_checkins.reviewed_at timestamptz`, `reviewed_by uuid → profiles` — "urgent" on the record is now *moderate-or-worse and not reviewed*, so a flagged reading stays on the From the patient tab until someone clears it (today the badge was derived from the readings alone and could never be dismissed).
  - Policy `staff review recovery checkins` (UPDATE for `is_staff`): staff could only read check-ins; marking one reviewed is the first staff write to that table. Patients' own-row policy and `clinic_isolation` are untouched.
  - `plan_milestone_checklist.done_by_kind text check (patient | clinic)`, `done_by uuid` — the step details panel shows "patient · 28 Sep" against each tick. Staff already had `FOR ALL` on the table (`20260922000000` L116–121), so no new policy.
  - Seeds `view.patients.overview = true` for manager, practitioner and front desk in `role_permissions` for every clinic, `ON CONFLICT DO NOTHING` so a clinic that has tuned the grid is left alone (same shape as `20261003000200_tasks_permissions.sql`).
- Live database: `supabase db push` (or `scripts/apply-migrations.mjs`) before the live clinic sees the Overview tab. Demo mode needs nothing.

### pr-p2-02-permission-key

- `src/lib/permissions.ts`: `view.patients.overview` in `PERMISSION_KEYS`, its `PERMISSION_META` ("Overview tab — See the record's Overview: today's visit, readiness, skin plan, upcoming bookings, tasks and the latest journal entry.") and the Visibility group, directly after `view.patients.record`.
- `src/lib/access-catalogue.ts`: node `patient-overview` (kind `tab`, parent `patient-record`, label "Overview", default on for every staff role via `staff()`), listed before `patient-treatments` so the access grid shows the tabs in page order. Demo grants come from the catalogue (`viewGrantRows()` in `data.ts` L397), so demo roles get the tab with no further seeding.
- `tests/unit/access-catalogue.test.ts` and `permissions.test.ts` pass unchanged.

### pr-p2-03-schemas

- `src/lib/validation/schemas.ts`:
  - `AcceptHistoryUpdate = { id, patient_id }` (beside `ReviewHistory`).
  - `ReviewRecoveryCheckin = { patient_id, checkin_date: dateString }` (beside `SubmitRecoveryCheckin`; check-ins are unique per patient and day, so the date is the key).
  - `SetMilestoneChecklistItem = { id, done }` (beside the portal's `ToggleChecklistItem`; same shape, staff path).
  - `UpdatePlanMilestoneDetails = { id, title: requiredText(200), due_date: optionalDateString, detail: optionalText(2000), status?: upcoming | current | done | skipped }` and `GetPatientPlanDetail = { patient_id }` (beside `UpdatePlanMilestone`).
- `check:validators` reports the two unused exports until Phase 3 wires the handlers; `check:policy` 191 handlers and `check:tenancy` 62 tables unchanged.

### pr-p2-04-demo-types

- `src/lib/demo/data.ts`: every generated checklist row now carries `done_by_kind` ("patient" for the first two items, "clinic" for the clinic-owned third, null while open) and `done_by: null`; every generated recovery check-in carries `reviewed_at`/`reviewed_by` (older readings reviewed by Dr Nadia Rahman the next morning, the latest left open). Olivia's fixtures keep their readings; this only adds the columns the twins will read.
- Gates: `tsc` no new errors (fresh baseline `/tmp/pr-baseline-tsc.txt`, 106 lines; the `data.ts(1324)` error is pre-existing from `489a6b4`, outside these hunks); per-hunk eslint 0; unit suite 272 passed with the 11 known failures.
