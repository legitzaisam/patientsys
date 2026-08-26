---
name: Phase 5 database hardening
overview: "Harden the database: revoke the write grants anon and authenticated hold on all 27 tables, make patient identity unique and deterministic, make signed consents immutable, add soft-delete with an 8-year legal hold and an explicit erasure path, enforce real clinic isolation in both RLS and the queries, add the nine missing indexes, reconcile the migration ledger, and move the ES256 workaround out of the auto-generated middleware."
todos:
  - id: p5-preflight
    content: Capture a pre-change snapshot of grants, constraints, policies, indexes and row counts as a reusable read-only introspection script, so every later assertion compares against a recorded baseline rather than memory
    status: completed
  - id: p5-grants
    content: "Migration: revoke INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon and TRUNCATE/REFERENCES/TRIGGER from authenticated on all 27 public tables, plus ALTER DEFAULT PRIVILEGES so new tables do not re-grant; verify the portal and staff paths still work"
    status: completed
  - id: p5-identity
    content: "Migration: UNIQUE on patients.user_id, rewrite handle_new_user to link exactly one patient row instead of every row sharing an email, and make current_patient_id deterministic"
    status: completed
  - id: p5-immutable
    content: "Migration: BEFORE UPDATE OR DELETE trigger on documents rejecting any change to a signed row's body, title, kind, status or signature fields - the one control in this phase that binds the service-role client"
    status: completed
  - id: p5-retention
    content: "Migration: soft-delete columns on patients (deleted_at, deleted_by, deletion_reason, legal_hold, retain_until), patient_retain_until() at 8 years from last treatment, a BEFORE DELETE guard trigger, an owner-only audited erase_patient() function, and drop the owners delete patients policy"
    status: completed
  - id: p5-tenancy-db
    content: "Migration: current_clinic_id() resolving from profiles then patients, SET NOT NULL on clinic_id across the 15 nullable tables, add clinic_id to role_permissions/treatment_colours/treatment_colour_themes with their key changes, and one RESTRICTIVE clinic_isolation policy per table"
    status: completed
  - id: p5-tenancy-app
    content: Expose identity.clinicId, add a scopedFrom() helper, retrofit the ~170 clinic-scoped query sites, delete the hardcoded CLINIC_ID constant, and add scripts/check-tenancy.mjs as npm run check:tenancy
    status: completed
  - id: p5-softdelete-app
    content: Add archivePatient to production and demo with a POLICY entry and zod schema, and an owner-only archive control on the patient page, so the retention model is reachable rather than a capability governing nothing
    status: completed
  - id: p5-indexes
    content: "Migration: the nine indexes from audit section 5.8, all IF NOT EXISTS"
    status: completed
  - id: p5-ledger
    content: Record the missing 20260824000000 version, then make apply-migrations.mjs ledger-aware so it skips applied migrations and records what it applies instead of re-running all 44 files silently
    status: completed
  - id: p5-es256
    content: Move the ES256 service-role middleware into src/lib/auth/session-middleware.server.ts, restore the auto-generated auth-middleware.ts to its pristine form, and repoint both importers
    status: completed
  - id: p5-verify
    content: "Verify: introspection assertions, a two-clinic isolation test proving cross-tenant reads fail through both RLS and the server functions, signed-document immutability against the service-role client, hard-delete and legal-hold refusals, regression and demo sweeps, tsc baseline, and all three check scripts green"
    status: completed
  - id: p5-docs
    content: "Docs: audit section 17 recording the three corrections to section 5 and what remains defence-in-depth only, the Phase 5 work log entry, docs/plans/phase-05-database-hardening.md, and tick phase-5 in the master plan"
    status: completed
  - id: p5-commit
    content: Commit split along revert lines - grants, identity, immutability, retention, tenancy, indexes and tooling as separate commits - then push to origin/main with legitzaisam's token passed inline
    status: in_progress
isProject: false
---

# Phase 5 — Database hardening

## The finding that shapes this phase

Every request runs through a **service-role client, which bypasses RLS entirely** (audit §4.1). So the eight items split into two kinds of work, and conflating them would produce a phase that looks finished and enforces nothing:

- **Binds today's traffic:** constraints, triggers, indexes, and `clinic_id` predicates written into the queries themselves.
- **Defence-in-depth only:** grants and RLS policies, which matter the day §4.1 is fixed and not before.

The plan states which category each change falls into rather than implying the database starts policing the app.

## What the live database says (verified, not inferred)

| Check | Result |
|---|---|
| Grants on 27 public tables | `anon` **and** `authenticated` both hold all 7 privileges, including `TRUNCATE` |
| `patients.user_id` | 5 rows, 1 linked, **no UNIQUE constraint**; only a plain index |
| Signed documents | 2 rows `signed`; `staff edit documents` allows unrestricted `UPDATE`; no immutability trigger |
| Policies referencing `clinic_id` | **0 of 94** |
| `clinic_id` NULL rows | **zero across all 15 nullable tables** — `SET NOT NULL` needs no backfill |
| Migration ledger | 43 applied vs 44 files; the missing one is **our own** `20260824000000_rbac_capability_keys.sql` |
| Query sites in `clinic.functions.ts` | 224 `.from(...)` calls, **4** filtered by `clinic_id` |

Three corrections to the audit, all of which change the work:

1. **§5.2 overstated the cascade.** Eight child FKs cascade, but `appointment_notes.patient_id` is `NO ACTION`, so deleting a patient who has any visit note already fails with an FK violation. And no application code deletes a patient at all — the exposure is the `owners delete patients` policy, not a UI button.
2. **§4.7 understated the grants.** It named `anon`; `authenticated` holds the same seven privileges. `TRUNCATE` is the one that matters, because **RLS does not restrict `TRUNCATE`** — no policy can stop it.
3. **`handle_new_user` runs an unbounded `UPDATE`**: `SET user_id = NEW.id WHERE user_id IS NULL AND lower(email) = lower(NEW.email)`. Adding `UNIQUE` naively converts a silent duplicate-link bug into a hard signup failure, so the trigger is fixed in the same migration.

## Decisions taken

**Tenancy: enforce it, one clinic per person.** `profiles.clinic_id` (staff) and `patients.clinic_id` (portal) are the source of truth. `is_staff`/`is_owner`/`has_role` are untouched — staff-ness stays global, clinic membership comes from the profile. A new `current_clinic_id()` supplies the predicate.

**Retention: 8 years after last treatment**, the NHS adult-record standard. Soft-delete plus legal hold, with erasure as a deliberate server-side function rather than a UI button.

## Database layer

Six migrations, deliberately separate so each reverts alone.

**1. Grants** — `20260826000000_revoke_client_write_grants.sql`

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
```

`authenticated` keeps `INSERT/UPDATE/DELETE` because RLS governs those and the portal needs them; it loses `TRUNCATE`, which RLS cannot govern. The `ALTER DEFAULT PRIVILEGES` line matters — without it the next table created re-grants everything.

**2. Patient identity** — `20260826001000_patient_identity_unique.sql`

`ADD CONSTRAINT patients_user_id_key UNIQUE (user_id)` (NULLs stay unconstrained, so the 4 unlinked patients are fine), then rewrite `handle_new_user` to link exactly one row via `WHERE id = (SELECT id ... ORDER BY created_at LIMIT 1)`, and give `current_patient_id()` a deterministic `ORDER BY`.

**3. Signed-document immutability** — `20260826002000_documents_signed_immutable.sql`

A `BEFORE UPDATE OR DELETE` trigger rejecting any change to `body`, `title`, `kind`, `status`, `signature_data`, `signed_at`, `signed_name`, `signed_ip` once `status = 'signed'`. **This one binds the service-role client** — triggers fire regardless of RLS — so it is the highest-value item in the migration set.

**4. Retention and erasure** — `20260826003000_patient_retention.sql`

- `patients` gains `deleted_at`, `deleted_by`, `deletion_reason`, `legal_hold boolean NOT NULL DEFAULT false`, `retain_until date`.
- `patient_retain_until(uuid)` computes last treatment or appointment date + 8 years.
- A `BEFORE DELETE` trigger on `patients` raises unless the session sets `app.allow_patient_erasure`, making the cascade unreachable from any route including service-role.
- `erase_patient(uuid, text)` — `SECURITY DEFINER`, refuses while `legal_hold` is set or `retain_until` is in the future, writes an `audit_log` row, then sets the flag and deletes.
- Drop the `owners delete patients` policy; deletion is now only reachable through that function.

**5. Tenancy** — `20260826004000_clinic_isolation.sql`

```sql
CREATE FUNCTION public.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT clinic_id FROM public.patients WHERE user_id = auth.uid()));
$$;
```

- `SET NOT NULL` on `clinic_id` for the 15 nullable tables (zero nulls, so no backfill).
- Add `clinic_id` to the three settings tables that lack it, backfilled to the single clinic. This changes two keys: `treatment_colours` PK becomes `(clinic_id, treatment_name)` and `role_permissions` UNIQUE becomes `(clinic_id, role, permission)`.
- **One `RESTRICTIVE` policy per table** rather than rewriting 94 permissive ones:

```sql
CREATE POLICY clinic_isolation ON public.appointments AS RESTRICTIVE FOR ALL
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
```

Postgres ANDs restrictive policies with every permissive one, so 19 statements achieve what 94 rewrites would, and reverting is 19 `DROP POLICY` lines instead of restoring 94 definitions.

`staff_documents`, `user_notes` and `staff_conversation_reads` stay scoped by owning user; `user_roles` gains nothing, per the one-clinic-per-person decision.

**6. Indexes** — `20260826005000_missing_indexes.sql`

The nine from audit §5.8, all `IF NOT EXISTS`: `treatments(performed_at)`, `messages(author, read_at, created_at DESC)`, `patients(last_name, first_name)`, `documents(status, sent_at)`, `medical_history_versions(source, created_at DESC)`, `user_roles(role)`, `appointments(clinic_id, practitioner_id, starts_at)`, `appointments(patient_id, status, starts_at)`, `patients(created_at)`.

## Application layer

**Tenancy in the queries** is the bulk of the work and the only part that binds current traffic.

- [src/lib/auth/guards.server.ts](src/lib/auth/guards.server.ts): `readIdentity` already selects `profiles.clinic_id` at line 45; add `clinic_id` to the patient select and expose `identity.clinicId`.
- Add `scopedFrom(ctx, identity, table)` returning a builder pre-filtered by `clinic_id`, and retrofit the ~170 sites that hit a clinic-scoped table — the same mechanical pattern as the Phase 3 `authorize()` retrofit.
- Delete the hardcoded `const CLINIC_ID` at [clinic.functions.ts:27](src/lib/clinic.functions.ts) and write `identity.clinicId` instead.
- `scripts/check-tenancy.mjs`, registered as `npm run check:tenancy`, fails when a clinic-scoped table is queried without going through the helper — matching the `check:policy` and `check:validators` convention.

**Soft delete** gets `archivePatient` in both `clinic.functions.ts` and its demo twin, a `POLICY` entry, a zod schema, and an owner-only control on [patients.$id.tsx](src/routes/_authenticated/patients.$id.tsx). Erasure stays server-side only; a GDPR request should not be one click.

**ES256 extraction.** Move the whole middleware into a new `src/lib/auth/session-middleware.server.ts`, restore [auth-middleware.ts](src/integrations/supabase/auth-middleware.ts) to its generated form, and repoint the two importers. The hand-edit at lines 98-119 sits in a file whose first line reads "automatically generated. Do not edit it directly", and the branch syncs to Lovable.

**Ledger.** Insert the missing `20260824000000` row, then make [scripts/apply-migrations.mjs](scripts/apply-migrations.mjs) read `supabase_migrations.schema_migrations`, skip what is applied, and record what it applies. Today it runs all 44 files every time and records nothing, which is how this drift happened.

## Verification

- Re-run the introspection: zero write grants for `anon`, `TRUNCATE` gone from both roles, `patients_user_id_key` present, 19 `clinic_isolation` policies, 9 new indexes, ledger 44 of 44.
- **Cross-clinic isolation test**: create a second clinic with its own staff user and patient, prove each side cannot read the other through both RLS and the server functions, then clean up. This is the test that decides whether the tenancy work is real.
- **Immutability test**: update a signed document through the service-role client and confirm rejection — this is what proves a trigger binds where a policy does not.
- **Retention tests**: hard delete refused; `erase_patient` refused under legal hold and inside the 8-year window; permitted and audited outside it.
- Regression: `/tmp/p2-regress.mjs`, `/tmp/p3-positive.mjs`, `/tmp/p2-staffside.mjs`, plus the demo sweep, all with zero console errors.
- Static: `tsc --noEmit` at the 52-error baseline; `check:policy`, `check:validators` and the new `check:tenancy` green.

## Risks

- **The retrofit is the risk, not the SQL.** Over-scoping a query hides rows rather than erroring, which regression sweeps catch only where they look. The check script bounds this by proving every site is scoped; it cannot prove each scope is right.
- `SET NOT NULL` plus the restrictive policies will break any write path that omits `clinic_id` — six insert sites do today and are fixed in the same commit.
- Revoking `authenticated` grants is the change most likely to break something unseen, so it ships as its own commit and reverts alone.
- `erase_patient` is genuinely destructive. It is owner-only, audited, and guarded twice, but a bug there loses a medical record permanently.

## Out of scope

Fixing §4.1 itself — moving off the service-role client is the real fix and belongs with the auth work in Phase 6. The 26 `select("*")` calls and `documents.access_token` leaking through `getPatient` and `getMyRecord` (§5.9). The missing foreign keys in §5.10. Making the 44 existing migrations idempotent (§5.6). Archive UI beyond a single owner-only control.
