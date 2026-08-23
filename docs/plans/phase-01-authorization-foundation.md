# Phase 1 Micro-Plan — Authorization foundation

**Parent:** Aetheria Remediation Master Plan, Phase 1
**Depends on:** Phase 0 (complete)
**Blocks:** Phase 2 (retrofitting the open handlers), Phase 3 (RBAC)
**Estimated effort:** 4-6 hours
**Risk:** medium. No handler changes its access rules, but this moves the function every one of 88 handlers depends on.

> Written before the work started and left unedited afterwards, per [README.md](README.md).
> What actually happened is in [../WORKLOG.md](../WORKLOG.md).

## Why this is next

Authorization is currently 40 scattered calls to `loadIdentity` followed by hand-written `if` statements, with six differently-shaped guards and no single place to change a rule. Phase 2 has to touch 22 handlers; doing that against the current structure means 22 chances to write a subtly different check. Build the layer once, correctly, then apply it mechanically.

Three bugs are fixed on the way, all of the same species: a failure is discarded and read as a negative answer.

## Preconditions

- On `main` at `572ba7a`, clean tree. Node 22.
- Baseline to beat: `npx tsc --noEmit` reports **52** errors. This must not increase.

## Two findings that shaped this plan

**`PERMISSION_KEYS` already existed twice.** [permissions.ts](../../src/lib/permissions.ts) defines it with `PERMISSION_META` and a `can()` helper; `clinic.functions.ts` defined a byte-identical second copy, and `requirePermission` reimplemented `can()` inline. The guards module imports from `permissions.ts` and the duplicate is deleted, so client and server now agree by construction. Closes part of audit §6.3.

**The audit's "31 open handlers" was an overcount.** The classifier recognised only the named helpers, so it missed nine handlers that guard inline. The genuinely unguarded set is **22**.

## Task group A — The guards module

### A1. `src/lib/auth/guards.server.ts`

Moved out of `clinic.functions.ts` unchanged in behaviour: `type Ctx`, `loadIdentity`, `AppMetaFlag`/`resolveAppMetaFlag`, `requirePermission`, `requireOwner`, `requireManager`. `PERMISSION_KEYS` now comes from `permissions.ts`.

`audit()` stays in `clinic.functions.ts` — it needs `CLINIC_ID`, which has 34 uses there, and moving it would force a third module for one constant.

Three new guards added, each returning the identity so callers stop re-loading it:

```ts
requireStaff(ctx)                            // owner | manager | practitioner | front_desk
requirePatientSelf(ctx, patientId)           // that patient only, not even staff
requireStaffOrOwnPatient(ctx, patientId)     // staff, or the patient who owns the row
```

These are deliberately unused until Phase 2.

### A2. Request-lifetime cache

A `WeakMap` keyed on the context object, which the auth middleware rebuilds per request. Caches the *promise*, not the value, so concurrent callers share one in-flight read rather than racing four queries each.

**Correcting the master plan's premise:** it claims "a page issuing eight server functions runs 32 redundant identity queries". Each server function is its own HTTP request, so this cache cannot dedupe across them and that figure is not achievable this way. What it removes is the repeat *within* a request — a guard loads the identity, then the handler loads it again — which is the dominant shape across the call sites.

### A3. The `getMe` trap

`getMe` re-reads identity twice after inserting the caller's first role. With a naive cache both reloads return the pre-insert identity (`roles: []`), execution falls through to the ex-staff check, and a brand-new owner is told **"Your clinic access has been removed"** on their first ever sign-in. `reloadIdentity()` exists for exactly these two sites and nowhere else.

### A4. `requireOwner` through `loadIdentity`

It previously ran its own query and discarded the error, so a transient database failure was indistinguishable from "not an owner". Routing through `loadIdentity`, which already throws on read failure, removes the bug by construction rather than by adding another error check. Free now that identity is cached.

### A5. `requirePermission` uses the shared `can()`

Removes the duplicated owner-override logic.

## Task group B — Stop discarding failures

### B1. `reviewProfileChange`

The `profile_change_requests` status write discarded its error, so an approval could apply the profile change, fail to mark the request reviewed, and still return `{ ok: true }` — leaving it pending and re-approvable. Now throws.

Not fixed: if the status write fails after the profile write succeeded, the change is applied and the request stays pending. Atomicity needs a transaction and belongs with the data-integrity work.

### B2. `audit()`

46 call sites, and the body never destructured the insert error, so every audit failure was silent. Now logged with actor, action and entity.

**Log, do not throw.** Every call site runs after its mutation has committed; throwing would report a successful clinical write as an error and invite a retry that duplicates it. Durable, tamper-evident auditing is §10.3.

## The guard decision table

What Phase 2 executes against. **Line numbers are at the end of Phase 1**, after the extraction shortened the file by 121 lines.

### `requireStaff` — 16 handlers

| Handler | Line | Why |
|---|---|---|
| `getDashboard` | 279 | Clinic-wide KPIs, all patients, pending consents, unread patient messages |
| `listPatients` | 543 | Unfiltered patient directory — the audit's headline finding, §4.2 |
| `getCatalogue` | 726 | Reference read, no PHI — see "confirm before Phase 2" |
| `listPractitioners` | 737 | All practitioner names and job titles |
| `listAppointments` | 755 | Whole-clinic diary for any date range |
| `updateAppointmentState` | 950 | Writes status/payment/stage by body ID |
| `addPhoto` | 1105 | Inserts a clinical photo against any `patient_id` |
| `resendDocument` | 1172 | Acts on any document by body ID |
| `listStaffDirectory` | 1310 | Full staff roster with roles. Also fix the `manager` omission, §13.3.2 |
| `getPractitionerDay` | 1392 | Any practitioner's schedule plus urgent alerts |
| `dismissStaffInboxItem` | 1464 | Already row-scoped by `recipient_id`/`sender_id`; guard is defence in depth |
| `listMessageTemplates` | 1604 | All clinic templates |
| `rescheduleAppointment` | 3229 | Moves any appointment by body ID |
| `listTreatmentColours` | 3278 | Reference read, no PHI — see "confirm before Phase 2" |
| `getClinicDetails` | 3516 | Clinic contact details — see "confirm before Phase 2" |
| `getAppointmentNote` | 3645 | Clinical visit notes for any appointment ID |

### `requireStaffOrOwnPatient(patientId)` — 2 handlers

| Handler | Line | Why |
|---|---|---|
| `getPatient` | 589 | Takes `data.id`, returns the full clinical record, no ownership predicate |
| `markMessagesRead` | 1649 | Patient branch filters by author but accepts any `patient_id` |

### `requirePermission("settings.treatments")` — 2 handlers

| Handler | Line | Why |
|---|---|---|
| `listColourThemes` | 3330 | Settings read whose sibling writer already checks this key |
| `listCatalogueItems` | 3434 | Includes inactive items; settings admin view |

### Branch guard — 1 handler

`getUnreadMessages` (1212). The patient branch is already correct — it scopes to `identity.patient.id` — and must be preserved. Only the staff branch needs `requireStaff`. **A guard at function entry would break the patient portal.** This is the one handler where the obvious move is wrong.

### Ownership predicate rather than a guard — 1 handler

`deleteMyDocument` (2704) already checks `isStaff`, but deletes by `.eq("id", data.id)` with no `user_id` filter, so any staff member can delete any other's documents. Audit §4.7. Needs the predicate, not a guard.

### Already guarded — leave alone

Nine handlers guard inline and were miscounted as open. Each verified by reading the code:

| Handler | Existing check |
|---|---|
| `saveMyNote` | Self-scoped: upserts on `user_id: context.userId`, takes no body ID |
| `deleteMessageTemplate` | `identity.canDelete` (owner only) |
| `deleteRecallTask` | `isOwner \|\| permissions.includes("tasks.delete")` |
| `listRecallTasks` | `identity.isStaff` |
| `listRolePermissions` | `identity.isStaff` |
| `deleteColourTheme` | `settings.treatments` |
| `saveCatalogueItem` | `settings.treatments` |
| `setCatalogueItemActive` | `settings.treatments` |
| `updateClinicDetails` | `settings.treatments` |

Two carry a residual in-staff IDOR that Phase 2 should note but need not fix: `listRecallTasks` lets any staff member read any patient's recall tasks, and `deleteMessageTemplate` is owner-gated but unscoped by author. For a single-clinic deployment both are acceptable.

### Confirm with the user before Phase 2

`getCatalogue`, `listTreatmentColours` and `getClinicDetails` are reference reads with no PHI. No patient route calls them today, so `requireStaff` is the safe default — but if the portal is later meant to show treatments or clinic contact details, these become patient-readable and the guard would have to come back off.

## Verification

1. `npx tsc --noEmit` no worse than 52, none in `guards.server.ts`.
2. No stale `loadIdentity`/`requireOwner`/`requireManager`/`requirePermission` definitions in `clinic.functions.ts`.
3. `reloadIdentity` appears at exactly the two `getMe` sites.
4. Signed in as owner: `/dashboard`, `/schedule`, `/patients`, `/patients/$id`, `/team`, `/settings`, `/performance`, `/retention` all load clean.
5. `audit_log` still gains a row per mutation.
6. `reviewProfileChange` still approves end to end.

## Residual risk

**The `getMe` bootstrap path cannot be tested here.** Both branches only fire for a user with no roles — the first-ever staff account, or a patient account linked to a `patients` row. The live project has neither spare, so A3 is verified by code review and check 3, not by execution.

**Phase 2 has a blocker.** Verifying that a guard denies the right people needs sign-in credentials for a practitioner, a front_desk user, a manager and a patient. Only the owner's are held. Without them the 22-handler retrofit can be verified by reading code and nothing else.

## Commits

1. `refactor: extract identity and authorization guards into src/lib/auth`
2. `fix: surface authorization and audit failures instead of swallowing them`
3. `docs: add the Phase 1 guard decision table and correct the open-handler count`

## Rollback

Commit 1 is a move plus a cache; reverting restores the previous structure with no data impact. Commit 2 changes three behaviours and reverts independently.

## Out of scope

**No handler gains or loses a guard** — that is Phase 2, including `deleteMyDocument`'s ownership predicate. No demo twin changes: the Vite plugin swaps `clinic.functions.ts` by resolved path, so `guards.server.ts` never loads in demo mode. No cross-request caching, no transport, no schema.
