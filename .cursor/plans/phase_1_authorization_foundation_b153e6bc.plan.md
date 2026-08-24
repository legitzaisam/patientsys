---
name: Phase 1 authorization foundation
overview: "Extract identity loading and authorization into a single guards module with a request-lifetime cache, fix three places where failures are swallowed, and produce the guard decision table that Phase 2 executes against. Almost entirely a refactor: only three behaviours change."
todos:
  - id: p1-module
    content: "A1: Create src/lib/auth/guards.server.ts - move Ctx, loadIdentity, AppMetaFlag/resolveAppMetaFlag, requirePermission, requireOwner, requireManager out of clinic.functions.ts; import PERMISSION_KEYS/PermissionKey/can from @/lib/permissions and delete the duplicate at clinic.functions.ts:54-63"
    status: completed
  - id: p1-guards
    content: "A1: Add requireStaff, requirePatientSelf(patientId) and requireStaffOrOwnPatient(patientId), each returning the identity so callers stop re-loading it"
    status: completed
  - id: p1-cache
    content: "A2+A3: Add the WeakMap promise cache keyed on the context object, plus reloadIdentity() for cache-busting; switch getMe:357 and :363 to reloadIdentity so the first-user owner bootstrap does not read stale roles and lock the new owner out"
    status: completed
  - id: p1-owner
    content: "A4+A5: Route requireOwner through loadIdentity so a database failure stops reading as 'not an owner', and make requirePermission use the shared can() helper"
    status: completed
  - id: p1-swap
    content: "A6: Update clinic.functions.ts imports and delete the originals; confirm no stale local definitions survive and all 117 Ctx references still resolve"
    status: completed
  - id: p1-review
    content: "B1: Fix reviewProfileChange:2717 - destructure and throw on the profile_change_requests status write, and record in the work log that the non-atomic partial-write window remains"
    status: completed
  - id: p1-audit-fn
    content: "B2: Make audit() surface its insert error via console.error across all 46 call sites, logging rather than throwing since every call runs after the mutation has committed"
    status: completed
  - id: p1-table
    content: "C1: Write docs/plans/phase-01-authorization-foundation.md including the guard decision table for all 22 open handlers, the 9 already guarded inline, and the 3 needing user confirmation"
    status: completed
  - id: p1-audit-doc
    content: "C2: Correct audit section 13.2 - the 31 figure overcounted because the classifier matched only named helpers; name the 9 inline-guarded handlers and state the corrected figure of 22"
    status: completed
  - id: p1-verify
    content: "Verify: tsc no worse than 52 errors, originals gone from clinic.functions.ts, reloadIdentity used at exactly the two getMe sites, all 8 owner routes load clean on 8080, audit_log still gains a row per mutation, reviewProfileChange still approves"
    status: completed
  - id: p1-close
    content: Commit in three parts, append the Phase 1 work log entry including the untestable getMe bootstrap risk, mark phase-1 complete, and raise the Phase 2 test-credentials blocker with the user
    status: completed
isProject: false
---

# Phase 1 Micro-Plan — Authorization foundation

**Parent:** Aetheria Remediation Master Plan, Phase 1
**Depends on:** Phase 0 (complete)
**Blocks:** Phase 2 (retrofitting the open handlers), Phase 3 (RBAC)
**Estimated effort:** 4-6 hours
**Risk:** medium. No handler changes its access rules, but this moves the function every one of 88 handlers depends on. The specific danger is documented in A3.

## Why this is next

Authorization is currently 40 scattered calls to `loadIdentity` followed by hand-written `if` statements, with six differently-shaped guards and no single place to change a rule. Phase 2 has to touch 22 handlers; doing that against the current structure means 22 chances to write a subtly different check. Build the layer once, correctly, then apply it mechanically.

Three bugs are fixed on the way, all of the same species: a failure is discarded and read as a negative answer.

## Preconditions

- On `main` at `572ba7a`, clean tree. Node 22 (`export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`).
- Baseline to beat: `npx tsc --noEmit` reports **52** errors. This must not increase.
- Only one dev server running, on 8080.

## Two findings that shape this plan

**`PERMISSION_KEYS` already exists twice.** [src/lib/permissions.ts](src/lib/permissions.ts) defines it with `PERMISSION_META` and a `can()` helper; [clinic.functions.ts:54-63](src/lib/clinic.functions.ts) defines a byte-identical second copy. Client components import the former, the server uses the latter, and `requirePermission` reimplements `can()` inline. The guards module imports from `permissions.ts` and the duplicate is deleted, so client and server agree by construction. This closes part of audit §6.3 for free.

**The audit's "31 open handlers" was an overcount.** My classifier only recognised the named helpers, so it missed nine handlers that guard inline — `deleteMessageTemplate` checks `identity.canDelete`, `deleteRecallTask` checks `tasks.delete`, `listRolePermissions` and `listRecallTasks` check `identity.isStaff`, `saveMyNote` is self-scoped to `context.userId`, and four settings writers check `settings.treatments`. Each verified by reading the code. The genuinely unguarded set is **22**. Task C2 corrects the audit.

## Task group A — The guards module

### A1. Create `src/lib/auth/guards.server.ts`

Move out of [clinic.functions.ts](src/lib/clinic.functions.ts), unchanged in behaviour: `type Ctx` (:14), `loadIdentity` (:65-135), `type AppMetaFlag` and `resolveAppMetaFlag` (:137-156, used only by `loadIdentity`), `requirePermission` (:304-311), `requireOwner` and `requireManager` (:1873-1887).

Delete the duplicate `PERMISSION_KEYS` at :54-63 and import from `@/lib/permissions` instead. `clinic.functions.ts` re-exports it (`export { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions"`) to keep export parity with the demo twin.

`audit()` (:313-331) **stays where it is** — it needs `CLINIC_ID`, which has 34 uses in `clinic.functions.ts`, and moving it would force a third module for one constant. It is fixed in place in B2.

Add the three new guards:

```ts
export async function requireStaff(context: Ctx) {
  const identity = await loadIdentity(context);
  if (!identity.isStaff) throw new Error("Staff access only");
  return identity;
}

export async function requirePatientSelf(context: Ctx, patientId: string) {
  const identity = await loadIdentity(context);
  if (identity.patient?.id !== patientId) throw new Error("Not your record");
  return identity;
}

export async function requireStaffOrOwnPatient(context: Ctx, patientId: string) {
  const identity = await loadIdentity(context);
  if (identity.isStaff || identity.patient?.id === patientId) return identity;
  throw new Error("Not your record");
}
```

Every guard returns the identity, so callers stop re-loading it.

### A2. Request-lifetime cache

The middleware builds a fresh context object per request, so a `WeakMap` keyed on it gives exactly request-lifetime semantics with no TTL and no staleness:

```ts
const identityCache = new WeakMap<object, Promise<Identity>>();

export function loadIdentity(context: Ctx): Promise<Identity> {
  const cached = identityCache.get(context);
  if (cached) return cached;
  const pending = readIdentity(context);
  identityCache.set(context, pending);
  return pending;
}
```

Cache the *promise*, not the value, so concurrent callers share one in-flight read rather than racing four queries each.

**Correcting the master plan's premise:** it claims "a page issuing eight server functions runs 32 redundant identity queries". Each server function is its own HTTP request, so this cache cannot dedupe across them and that figure is not achievable this way. What it does remove is the double-load *within* a request — `requirePermission` loads identity, then the handler loads it again — which is the dominant pattern across the 40 call sites. Roughly a halving, not a quartering.

### A3. The `getMe` trap — read this before writing the cache

[getMe](src/lib/clinic.functions.ts) deliberately re-reads identity twice after mutating the caller's own roles:

```
345:  let identity = await loadIdentity(context as Ctx);
352:    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "owner" });
357:    identity = await loadIdentity(context as Ctx);      // must bypass cache
362:    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "patient" });
363:    identity = await loadIdentity(context as Ctx);      // must bypass cache
```

With a naive cache both reloads return the pre-insert identity (`roles: []`), execution falls through to the check at :367, and the brand-new owner is told **"Your clinic access has been removed"** on their first ever sign-in. Export a cache-busting variant and use it at both sites, nowhere else:

```ts
/** Bypass the cache after mutating the caller's own roles. See getMe bootstrap. */
export function reloadIdentity(context: Ctx): Promise<Identity> {
  const pending = readIdentity(context);
  identityCache.set(context, pending);
  return pending;
}
```

### A4. Route `requireOwner` through `loadIdentity`

`requireOwner` currently runs its own query and discards the error, so a transient database failure is indistinguishable from "not an owner" and the owner is told they lack access. `loadIdentity` already throws a real message on read failure, so routing through it removes the bug by construction rather than by adding another error check:

```ts
export async function requireOwner(context: Ctx) {
  const identity = await loadIdentity(context);
  if (!identity.isOwner) throw new Error("Clinic owner access required");
  return identity;
}
```

Free now that identity is cached, and it makes all six guards agree on one source of truth. `requireManager` already does this and needs no change beyond moving.

### A5. `requirePermission` uses the shared `can()`

```ts
export async function requirePermission(context: Ctx, key: PermissionKey) {
  const identity = await requireStaff(context);
  if (!can(identity, key)) throw new Error("You do not have access to this area");
  return identity;
}
```

### A6. Update `clinic.functions.ts`

Import the moved symbols; delete the originals. 117 `Ctx` references and 40 `loadIdentity` call sites keep working unchanged — this is an import swap, not a rewrite. Verify no stale local definitions survive.

## Task group B — Stop discarding failures

### B1. `reviewProfileChange`

At [:2717](src/lib/clinic.functions.ts) the `profile_change_requests` status write discards its error, so an approval can apply the profile change, fail to mark the request reviewed, and still return `{ ok: true }` — leaving it pending and re-approvable. Destructure and throw.

State honestly in the work log what this does **not** fix: if the status write fails after the profile write succeeded, the change is applied and the request stays pending. Making the pair atomic needs a transaction and belongs with the data-integrity work, not here.

### B2. `audit()`

46 call sites, all `await audit(...)`, and the body never destructures the insert error — every audit failure is silent. Surface it:

```ts
const { error } = await context.supabase.from("audit_log").insert({ /* unchanged */ });
if (error) console.error(`[audit] failed to record ${action} on ${entity}:`, error.message);
```

**Log, do not throw.** Every call site runs *after* the mutation has committed; throwing would turn a successful clinical write into a client-visible error and could send the caller into a retry that duplicates the write. Durable, tamper-evident auditing is §10.3 and a later phase; this phase only stops the failure being invisible.

## Task group C — The decision table

### C1. Write `docs/plans/phase-01-authorization-foundation.md`

This plan, plus the table below, which is what Phase 2 executes against. Line numbers are at `572ba7a`.

**`requireStaff` (16):** `getDashboard` :373, `listPatients` :637, `getCatalogue` :820, `listPractitioners` :831, `listAppointments` :849, `updateAppointmentState` :1044, `addPhoto` :1199, `resendDocument` :1266, `listStaffDirectory` :1404, `getPractitionerDay` :1486, `dismissStaffInboxItem` :1558, `listMessageTemplates` :1698, `rescheduleAppointment` :3336, `listTreatmentColours` :3385, `getClinicDetails` :3623, `getAppointmentNote` :3752.

`dismissStaffInboxItem` is already row-scoped by `recipient_id`/`sender_id` at :1590-1609; the guard is defence in depth, not a fix.

**`requireStaffOrOwnPatient(patientId)` (2):** `getPatient` :683 — takes `data.id` and returns the full clinical record with no ownership predicate. `markMessagesRead` :1743 — the patient branch filters by author but accepts any `patient_id`.

**`requirePermission("settings.treatments")` (2):** `listColourThemes` :3437, `listCatalogueItems` :3541. Both are settings reads whose sibling writers already check this key.

**Branch guard (1):** `getUnreadMessages` :1306. The patient branch is already correct (`.eq("patient_id", identity.patient.id)` at :1317) and must be preserved; only the staff branch needs `requireStaff`. A guard at function entry would break the patient portal — this is the one handler where the obvious move is wrong.

**Ownership predicate rather than a guard (1):** `deleteMyDocument` :2811 already checks `isStaff`, but deletes by `.eq("id", data.id)` with no `user_id` filter, so any staff member can delete any other's documents. This is audit §4.7 and belongs to Phase 2's Tier B.

**Already guarded, leave alone (9):** `saveMyNote`, `deleteMessageTemplate`, `deleteRecallTask`, `listRecallTasks`, `listRolePermissions`, `deleteColourTheme`, `saveCatalogueItem`, `setCatalogueItemActive`, `updateClinicDetails`.

**Confirm with the user before Phase 2:** `getCatalogue`, `listTreatmentColours` and `getClinicDetails` are reference reads with no PHI. No patient route calls them today, so `requireStaff` is the safe default, but if the patient portal is later meant to show treatments or clinic contact details these become patient-readable.

### C2. Correct the audit

Append to §13.2 of [docs/AUDIT-2026-08-22.md](docs/AUDIT-2026-08-22.md): the 31 figure overcounted because the classifier matched only named helpers. Name the nine that guard inline, state the corrected figure of 22, and point at the decision table. §13.2 is the reference Phase 2 works from, so leaving it wrong would propagate.

## Verification

1. `npx tsc --noEmit` reports **no more than 52** errors, and none in `src/lib/auth/guards.server.ts`.
2. `rg -n 'async function (loadIdentity|requireOwner|requireManager|requirePermission)' src/lib/clinic.functions.ts` returns nothing — the originals are gone, not shadowed.
3. `rg -n 'reloadIdentity' src/lib/clinic.functions.ts` returns exactly the two `getMe` sites.
4. Signed in as owner on `localhost:8080`, all of `/dashboard`, `/schedule`, `/patients`, `/patients/$id`, `/team`, `/settings`, `/performance`, `/retention` load with no console errors. This exercises `requireOwner` at 11 sites, `requirePermission` at 4, and `loadIdentity` throughout.
5. Audit trail still writes: count `audit_log` rows, perform one mutation, confirm the count increased by one.
6. `reviewProfileChange` still approves a pending change end to end.

## Residual risk to record

**The `getMe` bootstrap path cannot be tested here.** Both branches only fire for a user with no roles — the first-ever staff account, or a patient account linked to a `patients` row. The live project has neither spare. A3 is therefore verified by code review and by check 3 above, not by execution. Flag it in the work log.

**Phase 2 has a blocker that should be resolved now.** Verifying that a guard actually denies the right people needs sign-in credentials for a practitioner, a front_desk user, a manager and a patient. We hold only the owner's. Without them Phase 2's 22-handler retrofit can be verified by reading code and nothing else. Either provision test accounts (an owner can set staff passwords, and there is no patient portal user at all yet) or accept unverified guards.

## Commits

1. `refactor: extract identity and authorization guards into src/lib/auth`
2. `fix: surface authorization and audit failures instead of swallowing them`
3. `docs: add the Phase 1 guard decision table and correct the open-handler count`

## Rollback

Commit 1 is a pure move plus a cache; reverting restores the previous structure with no data impact. Commit 2 changes three behaviours and can be reverted independently.

## Out of scope

**No handler gains or loses a guard** — that is the whole of Phase 2, including `deleteMyDocument`'s ownership predicate. No demo twin changes: the Vite plugin swaps `clinic.functions.ts` by resolved path, so `guards.server.ts` never loads in demo mode; the drift, including four team-admin handlers that have no owner gate in demo at all, is recorded for Phase 11. No cross-request identity caching. No new transport, no schema.

## On completion

Append the Phase 1 work log entry, set `phase-1` complete in the master plan, and put the Phase 2 credentials question to the user before starting it.