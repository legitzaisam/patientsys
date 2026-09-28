# Phase 4: schema, types, tenancy scope, demo fixtures

Branch `e2e_live`, on top of `bc3f08f`. 28 Sep 2026.

### p4-01-migration-tables

- `supabase/migrations/20261001000200_staff_schedule_invoices_bookable.sql`:
  - `staff_working_patterns` (clinic_id, user_id, weekday 0–6 Monday-first, start_time / end_time both null = day off with a check, updated_by / updated_at; unique per user and weekday).
  - `staff_time_off` (type holiday | training | sickness | other, starts_on ≤ ends_on, start_half / end_half full | half, working_days numeric(5,1), note, status pending | approved | declined | withdrawn, requested_at, reviewed_by / reviewed_at / reviewer_note).
  - `practitioner_treatments` (user_id, catalogue_id, unique).
  - `practitioner_invoices` (number `INV-<initials>-YYYY-MM`, period_start / period_end, recipient payroll | owner, note, status scheduled | sent | paid, scheduled_for, sent_at, paid_at, amount numeric(12,2), treatments; unique per user and period_start; partial index on scheduled_for for the drain).
  - Every table: clinic_id → clinics, RLS on, `REVOKE … FROM PUBLIC, anon, authenticated` then `GRANT … TO authenticated`, an `is_staff` policy and the `clinic_isolation` RESTRICTIVE policy, exactly as `20260930000300_clinic_setup_roles.sql`. Comments on every table.

### p4-02-types-scope

- `src/integrations/supabase/types.ts`: Row / Insert / Update / Relationships for the four tables in alphabetical position (generated shape, hand-written because the project has no Supabase CLI link on this machine).
- `src/lib/auth/clinic-scope.server.ts`: the four names added to `CLINIC_SCOPED_TABLES`.
- Checked: `check:tenancy` ok — 58 tables classified (49 clinic-scoped, 9 exempt).

### p4-03-demo-fixtures

- `src/lib/demo/data.ts`: `staffWorkingPatterns` (Nadia Mon/Wed 09:00–17:30, Thu 12:00–20:00, Fri 09:00–15:00, Sat 09:00–17:00, Tue and Sun off; Amara Mon–Thu 09:00–18:00 and Fri to 17:00; Tom Mon/Tue/Thu/Fri 10:00–19:00 and Sat 09:00–14:00; Sofia Mon–Fri 08:30–17:00; Maya Mon–Fri 09:00–17:30), `staffTimeOff` (Nadia: 14 working days taken earlier in the year across three approved rows, a training Wednesday about two weeks out, the following Monday–Friday holiday, and a pending Friday a month out — with the clinic clock on 28 Sep 2026 these land on the mockup's 14 Oct, 19–23 Oct and 30 Oct; Tom a week off in November; Sofia one pending day), `practitionerTreatments` (five for Nadia matching the mockup, seven for Amara, six for Tom, by catalogue name), `practitionerInvoices` (Nadia's previous-month invoice, sent on the 1st at 06:00, paid on the 5th, amount and count computed from her treatments with `shareOf` so the By-month table reconciles: `INV-NR-2026-08`, 124 treatments, £13,590).
- Dates are relative to the demo clock through a `dateOnlyOnWeekday(offset, weekday)` helper, so the fixture keeps its weekday shape on any day; `working_days` comes from `workingDaysBetween` with the person's own pattern.
- All four exported on `db`.

### p4-04-verify-commit

| Check | Result |
| ----- | ------ |
| `check:tenancy` | ok — 58 tables |
| tsc | 116 = baseline |
| Unit | 195 passed, the 11 pre-existing failures unchanged; metrics suite 16 passed + the 1 pre-existing |
| Lint | `data.ts` new lines Prettier-clean (the one reported finding is a pre-existing double blank line the diff tool re-keys); `types.ts` and `clinic-scope.server.ts` delta 0 |
| Probe | `db.staffTimeOff` for Nadia: 9 + 3 + 2 taken, 14 Oct training, 19–23 Oct (4 days), 30 Oct pending |
