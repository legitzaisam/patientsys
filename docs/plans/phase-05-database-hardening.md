# Phase 5 — Database hardening

**Status:** Complete
**Depends on:** Phase 4 (runtime validation)
**Work log:** [../WORKLOG.md](../WORKLOG.md)
**Audit:** §17 of [../AUDIT-2026-08-22.md](../AUDIT-2026-08-22.md)

**Rolls back with:** `git revert` of the relevant commit, but **the migrations do not roll back with the code**. Reverting the tenancy commit leaves 23 `RESTRICTIVE` policies in place with no application changes to match, which would break nothing today (the service-role client ignores them) but is not a clean state. Down-migrations were not written; reverting the database means writing them. This is the first phase in the sequence where that is true.

## The finding that shapes this phase

Every request runs through a **service-role client, which bypasses RLS entirely** (audit §4.1). So the eight items split into two kinds of work, and conflating them would have produced a phase that looked finished and enforced nothing:

- **Binds today's traffic:** constraints, triggers, indexes, and `clinic_id` predicates written into the queries themselves.
- **Defence-in-depth only:** grants and RLS policies, which matter the day §4.1 is fixed and not before.

## What the live database said, before anything changed

| Check | Result |
|---|---|
| Grants on 27 public tables | `anon` **and** `authenticated` both held all 7 privileges, including `TRUNCATE` |
| `patients.user_id` | 5 rows, 1 linked, **no UNIQUE constraint** |
| Signed documents | 2 rows `signed`; `staff edit documents` allowed unrestricted `UPDATE` |
| Policies referencing `clinic_id` | **0 of 94** |
| `clinic_id` NULL rows | **zero across all 15 nullable tables** — `SET NOT NULL` needed no backfill |
| Migration ledger | 43 applied vs 44 files; the missing one was **our own** `20260824000000` |

## Decisions taken before starting

**Tenancy: one clinic per person.** `profiles.clinic_id` for staff, `patients.clinic_id` for the portal. `is_staff`/`is_owner`/`has_role` untouched — staff-ness stays global, clinic membership comes from the profile.

**Retention: 8 years after last treatment**, the NHS adult-record standard. Soft delete plus legal hold, with erasure as a deliberate server-side function rather than a UI button.

**Isolation as 23 restrictive policies, not 94 rewrites.** Postgres ANDs restrictive policies with every permissive one, so the effect is identical and reverting is 23 `DROP POLICY` lines instead of restoring 94 definitions.

## Corrections to the audit, found while planning

1. **§5.2 overstated the cascade.** `appointment_notes.patient_id` is `NO ACTION`, so deleting a patient with any visit note already failed. And no application code deletes a patient — the exposure was a policy, not a button.
2. **§4.7 understated the grants.** It named `anon`; `authenticated` held the same seven. `TRUNCATE` is the one that mattered, because RLS does not restrict it.
3. **`handle_new_user` was the cause of §5.5**, not just a bystander. Adding `UNIQUE` alone would have turned a silent duplicate-link bug into a hard signup failure.

## Tasks

| # | Task | Verification |
|---|---|---|
| 0 | `scripts/db-snapshot.mjs` — diffable introspection | Before/after diff is the evidence for every claim below |
| 1 | Revoke client write grants | `anon` SELECT only; `TRUNCATE` gone from both roles |
| 2 | `UNIQUE (user_id)` + rewrite `handle_new_user` | Duplicate `user_id` rejected |
| 3 | Signed-document immutability trigger | Refused **through the service-role client** |
| 4 | Retention, legal hold, `erase_patient()` | Refused with no reason / under hold / inside window; permitted and audited outside |
| 5 | `current_clinic_id()`, `NOT NULL`, 23 isolation policies | Cross-clinic read and insert refused under RLS |
| 6 | `clinicScoped()` in the middleware; delete `CLINIC_ID` | Two-clinic test through the server functions |
| 7 | `archivePatient` + owner-only control | Round-trip: archive, drops out, restore, both audited |
| 8 | Nine indexes | Present in the snapshot |
| 9 | Ledger-aware `apply-migrations.mjs` | 50 of 50 |
| 10 | ES256 out of the generated middleware | Generated file restored byte-for-byte from `37e17a4` |
| 11 | Verify | See work log |
| 12 | Docs, then commits split along revert lines | — |

## Out of scope

Fixing §4.1 itself — moving off the service-role client is the real fix and belongs with the auth work in Phase 6. The 26 `select("*")` calls and `documents.access_token` leaking through `getPatient` and `getMyRecord` (§5.9). The missing foreign keys in §5.10. Making the 44 existing migrations idempotent (§5.6). Archive UI beyond a single owner-only control. Down-migrations.
