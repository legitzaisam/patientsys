# Phase 3 — Capability-based RBAC

**Status:** Complete
**Depends on:** Phase 2 (guard retrofit)
**Work log:** [../WORKLOG.md](../WORKLOG.md)
**Audit:** §15 of [../AUDIT-2026-08-22.md](../AUDIT-2026-08-22.md)
**Rolls back with:** `git revert` of the Phase 3 commit, plus `DELETE FROM role_permissions WHERE permission IN ('patients.edit','treatments.record','documents.send','photos.manage','appointments.edit','comms.send')`. The migration is additive and the delete is safe — reverting the code makes those keys unreferenced.

## Decisions taken before starting

Three questions were settled first, because each would have produced a different phase.

**Data scope: declare, do not change.** Every role's view of the data is identical after this phase. The scoping that already existed is now expressed in one table instead of three differently-worded inline expressions, and it is configurable. Nobody's dashboard moved.

**Policy map: enforced, not documentary.** A central `POLICY` record keyed by handler name, with one `authorize(ctx, name)` call per handler. The alternative — a map used only for tests — would have documented the problem without fixing it.

**Key expansion: targeted.** Six new keys where roles genuinely differ or a gap existed, rather than all twelve from the master plan. View-level keys like `patients.view` were skipped: every staff role sees every patient today, so the key would encode a distinction that does not exist.

## Deviation flagged at planning time

`patients.delete` was dropped. No handler hard-deletes a patient or its child rows, so it would have been a switch in the owner's grid governing nothing. **`patients.edit` replaced it**, governing `savePatient`.

## What planning found

Scoping the phase surfaced a worse problem than the one it was meant to solve: six clinical write handlers with no authorization of any kind. See §15.1.1 of the audit. That became Tier 0 and landed first.

The lesson is in how it was found. Phase 2's list came from reading handler bodies. This one came from a mechanical sweep. The difference is the whole justification for the policy map.

## Tasks

| # | Task | Verification |
|---|---|---|
| 0 | Close `savePatient`, `addTreatment`, `saveAppointment`, `sendDocument`, `reviewHistory`, `saveAppointmentNote` | Attack as patient: exploitable before, refused after |
| 1 | `PERMISSION_KEYS` 7 to 13 with `PERMISSION_META` and `PERMISSION_GROUPS` | Grid renders 13 rows in 6 sections |
| 2 | `auth/policy.ts` with 88 entries; `authorize()` in `guards.server.ts` | `npm run check:policy` |
| 3 | Retrofit ~45 ad-hoc checks | `rg` finds no inline identity authorization left |
| 4 | Completeness check wired to `npm run check:policy` | Fails when a handler is removed from the map |
| 5 | `resolveScope` for the three self-scoping handlers | Behaviour identical; regression sweep clean |
| 6 | `notifications.delete` on both dismiss handlers, not on mark-read | Bell still works for every staff role |
| 7 | Seed migration; delete the demo's duplicate key list | Demo and production enforce one list |
| 8 | Group the owner's grid | Six section headings render |
| 9 | Effective-permissions panel on the staff profile | "7 of 13 capabilities" renders, no console errors |
| 10 | `previous_role` on `updateStaffMember` | Audit entry names what changed from |
| 11 | Verify | See work log |
| 12 | Docs, then one commit | — |

## Out of scope

Per-user permission overrides. RLS-level capability enforcement — the database still enforces nothing for application traffic, and fixing that means moving off the service-role client. Any real change to who sees which patients. Zod validation, which is Phase 4. Reconciling the two disagreeing scope rules, which needs a product decision.
