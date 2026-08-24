---
name: Phase 3 RBAC
overview: "Turn Aetheria's coarse role checks into a capability model: close six completely unguarded clinical write handlers, expand the permission keys from 7 to 13, and route all 88 server functions through one declarative policy map so a missing guard becomes impossible rather than merely unlikely."
todos:
  - id: p3-critical
    content: "Tier 0: close the six completely unguarded clinical writers - savePatient, addTreatment, saveAppointment, sendDocument, reviewHistory, saveAppointmentNote - and confirm by attack as the patient account that each was exploitable before and is refused after"
    status: completed
  - id: p3-keys
    content: "Expand PERMISSION_KEYS from 7 to 13 in src/lib/permissions.ts with PERMISSION_META copy: patients.edit, appointments.edit, treatments.record, documents.send, photos.manage, comms.send (patients.delete dropped - zero handlers)"
    status: completed
  - id: p3-policy
    content: Create src/lib/auth/policy.ts with the Access union and a POLICY entry for all 88 handlers, plus authorize() in guards.server.ts that dispatches to the existing guards and returns the identity
    status: completed
  - id: p3-retrofit
    content: Replace the ~45 ad-hoc identity checks in clinic.functions.ts with authorize(), including the 8 verbatim settings.treatments expressions and ~20 inline isStaff throws; keep the patient branch of sendMessage capability-free
    status: completed
  - id: p3-completeness
    content: "Add the completeness assertion: every exported createServerFn has a POLICY entry and every POLICY entry has a handler, failing loudly at module load"
    status: completed
  - id: p3-scope
    content: Central resolveScope preserving today's behaviour exactly for getDashboard, getRetention and listOpenRecallTasks, with every other handler declaring clinic scope explicitly
    status: completed
  - id: p3-notif
    content: Enforce notifications.delete on dismissStaffInboxItem and dismissStaffInboxItems only, leaving markStaffNotificationRead ungated so the bell keeps working
    status: completed
  - id: p3-seed
    content: Migration seeding the six new keys enabled for manager, practitioner and front desk; delete the duplicate PERMISSION_KEYS in clinic.functions.demo.ts in favour of an import, and extend the demo seed in src/lib/demo/data.ts
    status: completed
  - id: p3-grid
    content: Group the access-control-settings grid into sections so 13 capabilities stay scannable
    status: completed
  - id: p3-viewer
    content: Effective-permissions panel on team.$id.tsx fed by getStaffProfile, derived from the same can() used at runtime
    status: completed
  - id: p3-audit-log
    content: Extend audit() coverage to updateStaffMember, revokeStaffAccess and restoreExTeamMember, matching setRolePermission
    status: completed
  - id: p3-verify
    content: "Verify: capability toggled off in the grid refuses at the handler, patient and practitioner attack runs, and owner/manager/patient regression sweeps with zero console errors and tsc no worse than baseline"
    status: completed
  - id: p3-docs
    content: "Docs: record the six unguarded writers as a new audit finding and resolve it, append the Phase 3 work log entry, write docs/plans/phase-03-rbac.md, and mark phase-3 completed in the master plan"
    status: completed
  - id: p3-commit
    content: Commit once at the end covering all of Phase 3, then push to origin/main with legitzaisam's token passed inline
    status: completed
isProject: false
---

# Phase 3 — Capability-based RBAC

## Critical finding, discovered while planning

Six clinical write handlers in [src/lib/clinic.functions.ts](src/lib/clinic.functions.ts) have **no authorization statement of any kind**. Phase 2 closed the 22 handlers the audit listed; these were never on that list. Any authenticated user — including a patient with a portal login — can call them today:

- `savePatient` (:1004) — create or edit any patient's demographics, allergies, medications, conditions
- `addTreatment` (:1065) — write a clinical treatment record against any patient
- `saveAppointment` (:782) — book, edit or cancel any appointment, and trigger portal messages
- `sendDocument` (:1145) — issue a consent document to any patient
- `reviewHistory` (:1700) — stamp a medical history version as clinically reviewed, under the caller's name
- `saveAppointmentNote` (:3732) — write into a clinical note

Each begins straight at `const supabase = (context as Ctx).supabase;` with no guard. Since `requireSupabaseAuth` hands the handler a service-role client, RLS enforces nothing. This is Tier 0 and lands before anything else in the phase.

A whole-file sweep found 17 of 88 handlers with no guard reference. The other 11 are self-scoped by `user_id = context.userId` (`getMyRecord`, `submitHistoryUpdate`, `changeOwnPassword`, `getMyNote`, staff notification reads), so they are safe by construction but still undeclared.

## Deviation from the master plan

`patients.delete` is dropped. No handler hard-deletes a patient or its child rows, so the key would be a switch in the owner's grid that governs nothing. **`patients.edit` replaces it**, governing `savePatient`. Key count is unchanged at six new.

## Design

Capabilities govern **staff only**. Patients hold no capabilities and are governed by ownership rules (`requirePatientSelf`, `requireStaffOrOwnPatient`). This matters for `sendMessage`, which both staff and patients call — the capability check applies only when `identity.isStaff`, or the portal composer breaks.

```mermaid
flowchart LR
  handler["handler body"] --> authorize["authorize(ctx, name)"]
  authorize --> policy["POLICY[name]"]
  policy --> guard["requireStaff / requirePermission / requirePatientSelf"]
  guard --> can["can(identity, key)"]
  can --> grants["role_permissions"]
  authorize --> scope["resolveScope(identity, name)"]
  scope --> handler
```

New file `src/lib/auth/policy.ts`:

```ts
export type Access =
  | { kind: "staff" }
  | { kind: "capability"; key: PermissionKey }
  | { kind: "manager" } | { kind: "owner" }
  | { kind: "staffOrOwnPatient" } | { kind: "patientSelf" }
  | { kind: "self" };            // any signed-in user; handler self-scopes by userId

export const POLICY: Record<string, Access> = {
  savePatient: { kind: "capability", key: "patients.edit" },
  getMyRecord: { kind: "self" },
  // ... all 88
};
```

`authorize()` lands in [src/lib/auth/guards.server.ts](src/lib/auth/guards.server.ts) beside the existing guards, dispatches on the entry, and returns the identity — so it replaces both the guard call and the `loadIdentity` that usually follows it. Handlers needing a resource pass it: `authorize(ctx, "getPatient", { patientId: data.id })`.

## Scope: declared, not changed

Per your decision, no user sees different data after this phase. `resolveScope` centralises the three handlers that already self-scope and preserves their current — and mutually inconsistent — rules:

- `getDashboard` and `getRetention`: own book for a practitioner who is not a manager; clinic for everyone else including front desk
- `listOpenRecallTasks`: own assignments for anyone who is not a manager, which **includes front desk**

Declaring them side by side is what makes that inconsistency visible. Every other handler declares `clinic` explicitly.

## Work

**Tier 0 — close the six.** Guard the handlers above through the policy map, then verify by attack as the patient test account that each is refused.

**Tier 1 — keys 7 to 13.** Add `patients.edit`, `appointments.edit`, `treatments.record`, `documents.send`, `photos.manage`, `comms.send` to [src/lib/permissions.ts](src/lib/permissions.ts) with `PERMISSION_META` copy. The grid in [src/components/access-control-settings.tsx](src/components/access-control-settings.tsx) already iterates `PERMISSION_KEYS`, so rows appear automatically; add section headings since 13 flat rows scan poorly.

**Tier 2 — retrofit.** Replace roughly 45 ad-hoc checks with `authorize()`, including eight verbatim copies of `!identity.isOwner && !identity.permissions.includes("settings.treatments")` and around 20 copies of `if (!identity.isStaff) throw`.

**Tier 3 — completeness assertion.** A module-load check that every `export const … = createServerFn` name has a `POLICY` entry, and that `POLICY` has no entry without a handler. This is the control that makes another six-handler hole impossible, and it is the fixture the Phase 11 test suite builds on.

**Tier 4 — `notifications.delete` server-side.** Enforce on `dismissStaffInboxItem` and `dismissStaffInboxItems` only. Not on `markStaffNotificationRead` — [notification-bell.tsx](src/components/notification-bell.tsx):71 gates the dismiss and complete buttons, not marking read, and guarding read would break the bell for practitioners and front desk.

**Tier 5 — defaults and demo parity.** A migration seeds the six new keys **enabled for manager, practitioner and front desk**, so no staff member loses an ability they have today; the owner can now tighten them, which is the point of the phase. The work log will record the recommended clinical tightening (front desk off for `treatments.record`) as a deliberate owner decision rather than a silent change. [src/lib/clinic.functions.demo.ts](src/lib/clinic.functions.demo.ts):30-38 keeps its own duplicate copy of `PERMISSION_KEYS` — delete it and import from `permissions.ts`, then extend the seed in [src/lib/demo/data.ts](src/lib/demo/data.ts):179.

**Tier 6 — effective-permissions viewer.** A panel on the staff profile at [team.$id.tsx](src/routes/_authenticated/team.$id.tsx):310, between the profile card and documents. `getStaffProfile` returns the resolved grants computed by the same `can()` used at runtime, so the display cannot disagree with enforcement. Owners render as "Full access (clinic owner)".

**Tier 7 — audit coverage.** `setRolePermission` already writes to `audit_log`; match it in `updateStaffMember`, `revokeStaffAccess` and `restoreExTeamMember`.

## Verification

Reuse the Phase 2 Playwright harness and the `TestPhase2!2026` accounts. Confirm each Tier 0 handler is exploitable as a patient before the fix and refused after; sweep owner, manager and patient routes for regressions and zero console errors; toggle a capability off in the grid and confirm the matching handler refuses.

## Out of scope

Per-user permission overrides, RLS-level capability enforcement, and any real change to who sees which patients. Zod validation is Phase 4.