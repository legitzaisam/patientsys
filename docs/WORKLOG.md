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

**Test accounts provisioned (Phase 2 precondition).** Two accounts were created with the service-role key, mirroring what `createStaffAccount` does:

| Account | Role | Signs in at | Lands on |
|---|---|---|---|
| `test.manager@aetheria.clinic` | `manager` | `/auth` | `/dashboard` |
| `damonsalvatore@hotmail.com` | `patient`, linked to the existing Damon Salvatore record | `/portal` | `/my-record` |

Both verified by signing in. The shared password is held outside the repo and is deliberately not recorded here. The manager account is disposable and should be deleted once Phase 2 is verified. Passwords for the three existing staff (Sofia Marchetti, Nadia Rahman, Tom Whitfield) are set by the owner through `/team`.

Worth noting what this proved: **a trigger creates a `profiles` row for every new auth user**, including patients. The provisioning script deletes it for the patient, because a profile row with no linked patient record is exactly the state that makes `getMe` throw "Your clinic access has been removed" — which is how the orphaned account below came about.

**One account is locked out and one profile is orphaned.** `z.bassim@hotmail.com` has an auth user and a `profiles` row but no role and no patient record, which sends `getMe` straight into "Your clinic access has been removed" on every sign-in. A second profile, "Invite Test", has no auth user at all — a residue of the invite flow. Neither is a Phase 1 regression; both predate it.

---

## Phase 2 — Guard retrofit

**Date:** 24 August 2026
**Plan:** [plans/phase-02-guard-retrofit.md](plans/phase-02-guard-retrofit.md)
**Base:** `f3a2190`
**Commit:** one, at the end of the phase, per the revised workflow

### Why the plan changed before it started

I mapped every server function a patient can actually reach before touching code, and it moved the phase's centre of gravity twice.

**Only 2 of the 22 open handlers are patient-reachable** — `markMessagesRead` and `getUnreadMessages`. The other 20 are staff-UI-only, so `requireStaff` on them could not break anything a user does today. The 22-handler retrofit was the low-risk half of the phase, not the dangerous half.

**The two worst vulnerabilities were not among the 22 at all.** `sendMessage` and `signDocument` are both patient-reachable and both had no guard whatsoever. They were the real work.

### Changed

**`sendMessage` no longer trusts the request body for identity.** It took `author` from `data.as`, so a patient could post into their own thread as `"staff"` and the message rendered as if it came from the clinic. In a clinical setting that is forged medical advice. The author is now derived from the session, and `requireStaffOrOwnPatient` scopes the thread so a patient cannot write into someone else's. `data.as` stays in the validator and is ignored; removing it from the client is Phase 4's work.

**`signDocument` no longer lets anyone sign anything.** It updated by `.eq("id", data.id)` with no guard at all, so any authenticated user could sign any consent form by ID. It now loads the document's `patient_id` and requires it to match the caller's own patient record.

**`deleteMyDocument` is scoped to the caller.** It checked `isStaff` and then deleted by ID, so any staff member could remove any other's work documents. Before changing it I confirmed no manager path depends on the old behaviour: the delete control sits behind `!readOnly`, and `/team/$id` renders `StaffDocuments` read-only.

**The 22 took their guards from the Phase 1 decision table** — 16 `requireStaff`, 2 `requireStaffOrOwnPatient`, 2 `requirePermission("settings.treatments")`, and `getUnreadMessages` guarded on its staff branch only.

### The one that had to be done differently

`getUnreadMessages` is polled by `NotificationBell` on every portal page. A guard at function entry would have broken the bell for every patient, so the guard sits after the patient branch returns. Phase 1 flagged this in advance, which is the only reason it was not written the obvious wrong way.

It is worth being honest that this guard is currently redundant: `isPatient` means `!isStaff`, so anything reaching the staff branch is already staff. It earns its place because that equivalence is exactly what makes the clinic-wide read safe, and Phase 10's portal work may well give a user both a staff role and a patient record.

### Verified by attack, not by reading

This is the first phase where a guard could be tested by trying to get past it, because the project now has a patient login. **Each attack was run before the fix to confirm it succeeded** — an attack never seen to work proves nothing when it later fails.

| Attack from the patient session | Before | After |
|---|---|---|
| Post to own thread as the clinic | stored `author: staff` | stored `author: patient` |
| Write into another patient's thread | message inserted | "Not your record" |
| Sign another patient's consent form | document marked `signed` | "Not your record" |
| Read the whole patient directory | full directory returned | "Staff access only" |
| Read another patient's clinical record | full record returned | "Not your record" |

The positive paths matter as much as the refusals, since the risk in this phase was locking real users out. The patient can still read their record, poll the bell, message their own thread, mark it read, **sign their own consent form** and submit a health update. Owner and manager both retain the patient directory, individual records, the dashboard, the catalogue and both settings reads — the manager case also confirms `requirePermission` grants correctly through `role_permissions` rather than only for owners.

Route sweeps for owner, manager and patient all render with **zero console errors**, and `npx tsc --noEmit` holds at the 52-error baseline.

### Cleaning up after the attacks

The attacks wrote real rows to the live project: a forged signature on a real patient's consent form and messages in a thread that was not ours. Prior state was captured first and restored afterwards — the consent form is back to `sent` with null signature fields, and the affected thread is back to its original two messages. All test messages, the temporary test document and the test health-history row were deleted, and the residual count verified at zero.

### Deferred

**Patients can still reach staff route chrome** (audit §14.3.1). `_authenticated/route.tsx` gates on session, not role, so a patient typing `/retention` or `/earnings` gets the staff page shell with empty data. No PHI leaks — every query is client-gated and now server-guarded — but it reads as a broken page rather than a refusal. One central role gate would fix all of them; left out so this phase stays server-side and revertable on its own.

Two in-staff IDORs remain and are noted for Phase 3: `listRecallTasks` lets any staff member read any patient's recall tasks, and `deleteMessageTemplate` is owner-gated but unscoped by author.

### Residual risk

**Every guard added here is application-layer.** §4.1 is untouched: the service-role client still bypasses RLS, so the database enforces nothing for application traffic. A handler that forgets its guard is open again, and nothing below it will catch that. Closing it properly means moving off the service-role client, which is architectural.

**Two roles remain untested.** We hold owner, manager and patient logins. Practitioner and front_desk still have no passwords set, so their views of these guards are verified by reasoning about `isStaff` and nothing more.

---

## Phase 3 — Capability-based RBAC

**Date:** 24 Aug 2026
**Plan:** [plans/phase-03-rbac.md](plans/phase-03-rbac.md)
**Audit:** §15 of [AUDIT-2026-08-22.md](AUDIT-2026-08-22.md)

### What this phase actually found

The phase was scoped as "turn coarse role checks into a capability model". Planning it turned up something worse than the thing it was meant to fix.

Phase 2 closed the 22 handlers the audit listed, and that felt like the end of the authorization work. It was not, because the list was never complete — it had been assembled by reading handler bodies, and reading 88 handler bodies is not a control. A mechanical sweep found **six clinical write handlers with no authorization statement of any kind**: `savePatient`, `addTreatment`, `saveAppointment`, `sendDocument`, `reviewHistory` and `saveAppointmentNote`.

We proved it rather than assuming it. Signed in as the patient test account against the live project, five of the six wrote real rows. The one that matters clinically: a patient set another patient's allergies to "none, safe to inject anything". Another stamped a medical history version as clinically reviewed, `reviewed_by` set to the patient's own auth user id. `addTreatment` and `saveAppointment` reached the database and bounced off a foreign key, not off a permission check.

All of it was restored afterwards and the row counts verified back at baseline.

### Changes

**Tier 0 — the six.** Each now carries a capability through the policy map: `patients.edit`, `treatments.record` (three of them), `appointments.edit` and `documents.send`.

**The policy map.** [auth/policy.ts](../src/lib/auth/policy.ts) declares an access rule for all 88 handlers. [guards.server.ts](../src/lib/auth/guards.server.ts) gained `authorize(ctx, name, resource?)`, which reads the rule and dispatches to the guards that already existed, returning the identity — so it replaces both the guard call and the `loadIdentity` that usually followed it.

**The check that makes it stick.** `npm run check:policy` fails when a handler has no entry, when it never calls `authorize`, or when the map names a handler that does not exist. This is the actual deliverable of the phase. The capability keys are useful; the build failing when someone adds an unguarded handler is what prevents a repeat.

**The retrofit.** Roughly 45 ad-hoc checks in `clinic.functions.ts` are gone: eight verbatim copies of `!identity.isOwner && !identity.permissions.includes("settings.treatments")`, around twenty `if (!identity.isStaff) throw`, and the rest. 80 handlers were rewritten by script, 8 ownership-based ones by hand.

**Keys, 7 to 13.** Added `patients.edit`, `treatments.record`, `documents.send`, `photos.manage`, `appointments.edit`, `comms.send`. Seeded enabled for manager, practitioner and front desk so nobody lost an ability they had.

**Scope.** `resolveScope` centralises the three handlers that already narrowed data, preserving each rule exactly.

**UI.** The owner's grid is grouped into six sections. A new panel on the staff profile answers "what can this person actually do", computed server-side through the same `can()` the guards call, so the display cannot disagree with enforcement.

### Deviations from the plan

**`patients.delete` was dropped.** The master plan listed it; no handler hard-deletes a patient or its child rows, so it would have been a switch in the owner's grid governing nothing. `patients.edit` replaced it and governs `savePatient`. Flagged before starting.

**The audit-coverage task was already done.** The plan asked for `audit()` on `updateStaffMember`, `revokeStaffAccess` and `restoreExTeamMember`. All eleven access-changing handlers already had it. What was genuinely missing was the *previous* role on a role change, so `updateStaffMember` now records `previous_role` — an audit entry saying only what someone was changed *to* does not tell you a demotion happened.

**One UI change beyond the plan.** [sent-staff-alerts.tsx](../src/components/sent-staff-alerts.tsx) let practitioners and front desk dismiss inbox items with no capability check, because the server was not enforcing `notifications.delete`. Enforcing it would have left a visible button that fails on click, so `DismissButton` now hides itself when the caller lacks the key — matching what `notification-bell.tsx` already did.

### Verification

**The attack, both ways.** Seven attacks as the patient. Before: 7/7 reached the database, 5 wrote rows. After: 7/7 refused with "Staff access only", and a database read confirmed nothing was written.

**Capability actually governs the handler.** Not a code-reading exercise: flip a grant off in `role_permissions` (what the owner's grid writes) and call the handler again. 8/8 as expected across `patients.edit`/`savePatient`, `treatments.record`/`saveAppointmentNote`, `documents.send`/`resendDocument` and `settings.treatments`/`listCatalogueItems` — allowed with the grant on, refused with it off.

**Phase 2 protections held.** Re-ran the Phase 2 attacks: cross-thread messaging, signature forgery, patient directory and cross-patient record reads all still refused. Impersonation via `as: "staff"` still lands as `author: patient`, confirmed by reading the row back.

**No regressions.** Owner and manager across eight routes each, patient on the portal: every page renders, zero console errors. All six patient portal actions work, including signing their own consent form. Owner and manager staff-side paths all work.

**Static.** `npx tsc --noEmit` holds at the 52-error baseline. `npm run check:policy` passes at 88/88.

### Note on a stale fixture

The Phase 2 positive test failed on "sign OWN consent form" with "Document not found". Not a regression — the document that test referenced had been deleted from the project some time earlier, and `signDocument` checks existence before ownership. Recreated a real document for that patient and the sign path passed.

### Deferred

**Front desk keeps `treatments.record` for now.** Seeding every new key enabled for every staff role was deliberate: the phase should not silently remove an ability someone uses. But a receptionist holding clinical note and treatment write is not a defensible default. Turning it off is one switch in the owner's grid and should be a clinic decision, not one made here.

**The two scoping rules still disagree.** Retention narrows a practitioner but not front desk; open tasks narrow anyone below manager, front desk included. Both are preserved exactly as they were, now visible side by side in one table. Reconciling them is a product decision.

**`listRecallTasks` remains an in-staff IDOR** — any staff member can read any patient's recall tasks.

**A pre-existing ordering bug in `updateStaffMember`**, not touched: the profile row is written at line 1934 before the self-demotion check throws at 1935, so a manager who tries to demote themselves gets the error but their profile edits have already been saved. Noted, not fixed, because it is unrelated to this phase.

### Residual risk

**The control is still application-layer.** `npm run check:policy` proves every handler calls `authorize`. It cannot prove the rule attached to a handler is the *right* rule — that judgment is still per-handler and still human. And §4.1 is untouched: the service-role client bypasses RLS, so the database enforces nothing underneath any of this.

**Practitioner and front desk are still untested.** Two of the five roles have no password set. Their behaviour under the new capability checks is verified from the grant table and by reasoning about `can()`, not by signing in. Given this phase changed what those two roles can reach, that gap is now more material than it was in Phase 2.

---

## Phase 4 — Runtime validation with zod

**Date:** 2026-08-24
**Plan:** [plans/phase-04-validation.md](plans/phase-04-validation.md)
**Audit sections closed:** §4.8 (no runtime validation), and §4.8's stored-XSS claim corrected rather than fixed.

### What changed

**All 62 validators now parse.** `src/lib/validation/` holds 62 named schemas built on a shared primitive set, and every `.validator(...)` in both `clinic.functions.ts` and its demo twin calls `parseInput(Schema, data)`. Zero pass-throughs remain in either file. Zod was already a dependency and had zero importers; it now has three.

**Validators keep their function form deliberately.** Passing a zod schema straight to `.validator()` works, but TanStack Start reports the failure as `JSON.stringify(issues, null, 2)`, and roughly 52 call sites feed `e.message` into `toast.error`. `parseInput` flattens the error to one sentence instead, so the existing toast pipeline stays useful without touching a single `onError`. It also keeps the declared input type at each call site, which avoided type churn across 62 handlers.

**Production and demo share one source.** The Vite plugin only rewrites `clinic.functions.ts`, so `src/lib/validation/` is never swapped. Unlike the Phase 1 guards, both sides validate identically with no drift to accept.

**`saveAppointmentNote` now sanitises.** Defence-in-depth only — see the correction below.

**Four pilot forms gained inline errors**, finally consuming `ui/form.tsx`, which had sat orphaned since the shadcn install: `invite-staff-dialog`, `patients.index` new-patient, `treatment-catalogue-settings` and `team.$id`. The invite dialog's hand-rolled email error state was replaced while keeping its "Did you mean …? Yes" one-tap correction.

**`npm run check:validators`** joins `check:policy`: it fails on a pass-through validator, an unused schema, a prod/demo schema mismatch, or a schema whose fields do not match the fields its validator declares.

### The audit was wrong and this is the correction

§4.8 called the missing sanitiser on `saveAppointmentNote` "a stored-XSS path into a clinical record". Appointment notes render as escaped React text in both places they appear, and the only `dangerouslySetInnerHTML` in `src/` is static chart CSS. There was no sink, so no live vulnerability — the finding should have been Low, not High. The sanitiser was added anyway, because these notes are one product decision away from the rich-text editor. §16.3 records this as a correction, not a fix.

### Verification

**Malformed input is refused readably.** 12 malformed payloads against representative handlers — missing required fields, wrong primitive types, out-of-range numbers, invalid enum values, an over-length body, a role not assignable through the grid — every one refused with a sentence a user could act on, not a JSON blob and not a 500. Five positive controls in the same session still returned 200.

**Unknown keys are dropped.** `savePatient` with injected `clinic_id` and `role` returns 200 with the extra keys silently stripped by `z.object`, which is the intended behaviour and worth stating explicitly.

**No regressions.** Owner, manager and patient across every route: zero console errors. All six patient portal paths work, all staff-side paths work. A demo-mode sweep across four roles confirms the non-UUID fixture ids validate — the specific reason no schema uses `.uuid()`.

**Forms.** 10/10 checks: inline errors appear under the right field with readable wording, and valid submits still save.

**Static.** `tsc --noEmit` holds at the 52-error baseline. `check:policy` 88/88, `check:validators` 62/62.

### Two bugs found while verifying, both in the wording

The first pass produced "String must contain at least 1 character(s)" in the browser and friendly text on the server, because the friendly error map was only applied inside `parseInput`. Making it zod's global default via `z.setErrorMap` fixed both sides from one place — `zodResolver` picks it up automatically.

The second: numeric fields read "Value is too small" instead of "Price is too small", because `numericText` validates the coerced number through an inner schema whose issues carry no path. Re-raising them without the precomputed message lets the outer map recompute the wording against the real field.

### Deferred

**`quick-add-appointment` and the `schedule.tsx` booking dialog have no inline validation.** Both branch into an inline new-patient path spanning two schemas and are the highest-regression forms in the app. They belong in their own pass now that the pattern is proven.

**Every other form still validates only on the round trip.** Server enforcement is real everywhere; inline errors exist on four surfaces.

**`sendMessage` still declares `as`.** Phase 2 made the handler ignore it and Phase 3 left it; the schema now types it as an enum, but the field is inert and still present because the client sends it. Removing it means touching the callers.

**The Tiptap duplicate `link`/`underline` warning** in `rich-notes-editor.tsx:92` is still there. Out of scope, still noisy.

### Residual risk

**`sanitizeNoteHtml` is a regex, not a sanitiser.** It is now on both note paths, but it should not be trusted against a determined payload. `saveMyNote` is the one with a real sink — Tiptap `setContent` re-parses that HTML on read. The note is self-scoped, so the exposure is self-XSS. DOMPurify is the actual fix and this phase did not do it.

**A schema could be stricter than reality in a field nothing sampled.** The attack script proves rejection and the sweeps prove acceptance, but neither enumerates all 62 shapes. The bound on this is that schemas mirror the declared types plus enums, ranges and lengths — no format assertions were added, precisely because `.uuid()` would have broken demo mode on day one.

**Validation still does not imply authorization.** A payload that parses cleanly is still subject to the Phase 3 policy map, and §4.1 is untouched: the service-role client bypasses RLS, so the database still enforces nothing underneath any of this.
