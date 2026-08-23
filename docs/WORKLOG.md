# Work log

Append-only record of remediation work against [AUDIT-2026-08-22.md](AUDIT-2026-08-22.md).

**The convention.** One entry per phase, appended at the bottom, newest last. Never edit an existing entry — if something turns out to be wrong, say so in a later entry. The point of this file is to be able to answer "why is the code like this?" six months from now without reading fourteen pull requests.

**What each entry must contain.** Date, phase, the commits, what changed, how it was verified, what was deliberately deferred, and what risk is left standing. The last two matter most: a phase that closes cleanly teaches nothing, whereas a phase that left something undone needs to say what and why while the reason is still fresh.

**The loop.** Each phase is: write a micro-plan in [plans/](plans/), get it approved, build it, verify it, append here, then tick the phase off in the master plan. Micro-plans are written before the work and left unedited afterwards, so the gap between what was planned and what this log says happened is itself information.

---

## Phase 0 — Audit refresh and emergency copy fix

**Date:** 23 August 2026
**Plan:** [plans/phase-00-audit-refresh.md](plans/phase-00-audit-refresh.md)
**Base:** `c443aac`
**Commits:** copy fix, audit refresh, scaffolding (three, so the copy fix reverts independently)

### Why this went first

Nine places in the UI told staff that a consent reminder or a payment link had been delivered to a patient's email address or mobile number. Several named the address in the success toast. Nothing was ever sent — the clinic has no email or SMS transport at all — so what actually happened was a row written to an in-app portal thread that most patients cannot see, since none of the live accounts are portal users.

Patients were arriving unconsented and undeposited and nobody could work out why, because the system reported success every time. That is a clinical and financial risk, it depends on none of the twelve phases that follow, and it costs a few hours to remove. So it shipped first.

### Changed

**Copy (nine sites, no behaviour change).** Consent reminder toasts in [today-snapshot.tsx](../src/components/dashboard/today-snapshot.tsx) and [schedule.tsx](../src/routes/_authenticated/schedule.tsx), payment and deposit toasts in the same two files, document toasts in [patients.$id.tsx](../src/routes/_authenticated/patients.$id.tsx), three static strings in the booking dialog, and the source comment at `clinic.functions.ts:959`. All now describe the portal thread, which is what actually happens.

`bookingNotifyDescription()` in [payment-link.ts](../src/lib/payment-link.ts) was the root of the booking claim — it interpolated the patient's email and phone into "sent by email (x) and text (y)". It now takes no arguments and returns one honest sentence, with a comment stating that dispatch arrives in Phase 9 so the claim is not reinstated by the next developer. Its two call sites lost the arguments, and the `res` parameter each `onSuccess` had been holding purely to feed it.

**Deliberately not changed.** [invite-staff-dialog.tsx](../src/components/invite-staff-dialog.tsx) was read in full and left alone. "Invitation created" is true, and the "Email instructions" button opens the manager's own mail client rather than claiming the system sent anything. A correct string is not a bug.

**Docs.** Section 13 appended to the audit, covering the fourteen commits since `a97236f`, corrected metrics, four new findings and the RBAC positives. Sections 1–12 untouched.

**Tooling.** `.node-version` pinned to 22.23.2 and an `engines` field added to `package.json`.

### Verified

- `rg -n 'sent to \$\{|by email and text|Reminder sent|Sent to patient' src` returns nothing. A broader sweep for eleven phrasings of "we sent an email/text" across all of `src` also returns nothing.
- `npx tsc --noEmit` reports **52** errors, down from **56** at `c443aac` — the four removed were `exactOptionalPropertyTypes` violations on the arguments `bookingNotifyDescription()` no longer takes. No new error, and no error at any line this phase touched. Baseline measured by stashing the changes and re-running.
- Driven as owner against the live Supabase project on `localhost:8080`, every string read back from the running UI rather than from the source:

  | Action | Toast |
  |---|---|
  | Dashboard consent chip → Email | `Consent reminder posted to their patient portal` |
  | Dashboard unpaid chip → Email | `Deposit link posted to their patient portal` |
  | Patient record → Send form | `Consent form issued - it is now in their portal` |
  | Patient record → Documents → Remind | `Reminder posted to their portal` |

  The `/schedule` booking dialog was checked in all three payment modes — Leave unpaid, Take payment, Send link — and none mentions email or text. No console errors on any step.

- Behaviour genuinely untouched: querying `messages` directly after the sweep shows both actions wrote real rows to the patient's thread, timestamped to the minute they were triggered.

### Deferred

Everything of substance. Phase 0 changed what the application *says*, not what it *does*. Consent reminders still reach nobody who is not already a portal user; that is Phases 7–9. No authorization finding was touched; that is Phases 1–3.

Two bugs were found while editing these files and, per the plan, recorded in the audit rather than fixed here: `listStaffDirectory` omits the `manager` role from the staff directory (§13.3.2), and staff chat attachment paths are client-supplied and unverified (§13.3.3).

### Residual risk

**High, and unchanged by this phase.** The honest copy makes the gap visible instead of hiding it, which is the entire point, but a clinic running this today still cannot contact a patient through the software. Staff need to be told explicitly that portal messages are not notifications and that anything time-critical must be phoned, until Phase 9 lands.

Also standing: `npx tsc --noEmit` does not pass and never has (§13.3.5). Until that is ratcheted down, no later phase can use "the types still pass" as evidence that a refactor was safe.

---

## Phase 1 — Authorization foundation

**Date:** 23 August 2026
**Plan:** [plans/phase-01-authorization-foundation.md](plans/phase-01-authorization-foundation.md)
**Base:** `572ba7a`
**Commits:** guards extraction, failure surfacing, docs (three)

### Why this went next

Authorization was 40 scattered `loadIdentity` calls followed by hand-written `if` statements, in six different shapes, with no single place to change a rule. Phase 2 has to touch 22 handlers; against that structure it would be 22 chances to write a subtly different check. Build the layer once, then apply it mechanically.

### Changed

**New module [src/lib/auth/guards.server.ts](../src/lib/auth/guards.server.ts).** `Ctx`, `loadIdentity`, `resolveAppMetaFlag`, `requirePermission`, `requireOwner` and `requireManager` moved out of the god-module unchanged in behaviour, joined by three new guards — `requireStaff`, `requirePatientSelf(patientId)` and `requireStaffOrOwnPatient(patientId)` — which are deliberately unused until Phase 2. Every guard now returns the identity, so callers stop re-loading it. `clinic.functions.ts` lost 121 lines.

**`PERMISSION_KEYS` was defined twice.** [permissions.ts](../src/lib/permissions.ts) had it with a `can()` helper for the client; the server file had a byte-identical copy and `requirePermission` reimplemented `can()` inline. There is now one list and one implementation, so client and server agree by construction.

**Identity cache.** A `WeakMap` keyed on the context object, which the auth middleware rebuilds per request. It caches the promise rather than the value, so callers arriving mid-flight share the read instead of racing another four queries.

**Two guards stopped lying about failure.** `requireOwner` ran its own query and discarded the error, so a database hiccup was indistinguishable from "not an owner" and told the owner they lacked access; it now resolves through `loadIdentity`, which already throws on a failed read, so the bug is gone by construction rather than by another error check. `reviewProfileChange` discarded the error on its status write, so an approval could apply the profile change, fail to mark the request reviewed, and still return `{ ok: true }`.

**`audit()` stopped being silent.** 46 call sites, and the insert error was never destructured. It now logs actor, action and entity. It deliberately does **not** throw: every call runs after its mutation has already committed, so throwing would report a successful clinical write as an error and invite a retry that duplicates it.

### Verified

- `npx tsc --noEmit` reports **52** errors, exactly the baseline, and **zero** in the new module. Nothing regressed and nothing was papered over.
- No stale `loadIdentity` / `requireOwner` / `requireManager` / `requirePermission` definitions survive in `clinic.functions.ts` — the originals are gone, not shadowed.
- `reloadIdentity` appears at exactly the two `getMe` sites and nowhere else.
- Signed in as owner on `localhost:8080`, all of `/dashboard`, `/schedule`, `/patients`, `/patients/$id`, `/team`, `/settings`, `/performance`, `/retention` and `/profile` render with **zero console errors**. Between them these exercise `requireOwner` at 11 sites and `requirePermission` for `team.view`, `reports.performance` and `reports.retention`.
- The audit trail still writes: `audit_log` went from 201 to 203 across the sweep, with a fresh `recall_task.status` row attributed to the owner.

### The trap that was worth writing down

`getMe` re-reads identity twice after inserting the caller's first role. With a naive cache both reloads would have returned the pre-insert identity (`roles: []`), execution would have fallen through to the ex-staff check, and a brand-new clinic owner would have been told **"Your clinic access has been removed"** on their first ever sign-in. `reloadIdentity()` exists for those two lines and nothing else.

### Deferred

No handler gained or lost a guard — that is the whole of Phase 2, including the ownership predicate `deleteMyDocument` needs. The decision table naming which guard each of the 22 open handlers takes is in the plan, with line numbers recomputed after the extraction so Phase 2 is not working from stale references.

No demo twin changes. The Vite plugin swaps `clinic.functions.ts` by resolved path, so `guards.server.ts` never loads in demo mode; demo remains looser than production on four team-admin handlers that have no owner gate there at all.

Found while working, recorded rather than fixed: the profile-change approval flow has no entry point (§13.3.6). Nothing in the UI calls `submitProfileChange`, so the queue `/team` renders can never receive a request.

### Residual risk

**Two of the six verification steps could not be executed, only reasoned about.**

The `getMe` bootstrap branches only fire for a user with no roles — the first-ever staff account, or a patient linked to a `patients` row. The live project has neither spare, so the fix for the trap above is backed by code review and a grep, not by a run.

`reviewProfileChange` could not be exercised end to end because nothing creates a request to review. The two-line error check typechecks and `/team` renders its queue without error, but the approval path itself is untested.

**Phase 2 is blocked on credentials and this should be settled before it starts.** Verifying that a guard denies the right people needs sign-in credentials for a practitioner, a front_desk user, a manager and a patient. Only the owner's are held, and there is no patient portal user at all. Without them, a 22-handler authorization retrofit can be verified by reading code and nothing else — which is precisely the kind of verification that lets an authorization bug through.

### Decisions taken at the close of Phase 1

**Test accounts will be provisioned before Phase 2.** The owner sets passwords for the existing staff; a patient portal user is created for the first time.

**The three reference reads become staff-only.** `getCatalogue`, `listTreatmentColours` and `getClinicDetails` take `requireStaff` in Phase 2. If the portal is later meant to show treatments or clinic contact details, that guard has to come back off deliberately rather than by default.

### What the roster actually contains

Queried while working out who could be given a test password. Three things that Phase 2 has to account for:

**There is no manager account.** The roles in use are `owner`, `practitioner` (Nadia Rahman, Tom Whitfield) and `front_desk` (Sofia Marchetti). The `manager` role was added by migration and is seeded in `role_permissions`, but nobody holds it — so the entire manager tier, including `requireManager` and the `team.approve_changes` permission, has never been exercised by a real session. One must be created.

**No patient can sign in.** Three `patients` rows exist and **none** has a `user_id`, so the portal has zero users. Every patient-facing guard, including the `getUnreadMessages` branch that Phase 2 must not break, is currently unreachable in this project.

**One account is locked out and one profile is orphaned.** `z.bassim@hotmail.com` has an auth user and a `profiles` row but no role and no patient record, which sends `getMe` straight into "Your clinic access has been removed" on every sign-in. A second profile, "Invite Test", has no auth user at all — a residue of the invite flow. Neither is a Phase 1 regression; both predate it.
