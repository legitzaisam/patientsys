---
name: Phase 0 audit refresh
overview: "Phase 0 micro-plan: remove every UI claim that an email or text was sent when only an in-app portal message was written, refresh the audit against HEAD c443aac, and establish the work log and micro-plan conventions the remaining twelve phases depend on. No behaviour changes, no schema changes."
todos:
  - id: p0-copy-consent
    content: "A1+A2: Fix the four consent and payment toasts in today-snapshot.tsx:871,946 and schedule.tsx:1049,1236 to say 'posted to their patient portal' instead of naming an email or phone number"
    status: completed
  - id: p0-copy-docs
    content: "A3: Fix the two document toasts in patients.$id.tsx:145,154 ('Sent to patient', 'Reminder sent') which back DB-only sendDocument/resendDocument"
    status: completed
  - id: p0-copy-booking
    content: "A4+A5+A6: Fix booking dialog copy at schedule.tsx:798,836,840, collapse bookingNotifyDescription() in payment-link.ts:84-95 to portal-only with a Phase 9 comment, correct the misleading comment at clinic.functions.ts:959"
    status: completed
  - id: p0-copy-verify
    content: "A7: Read invite-staff-dialog.tsx:98 surrounding copy and change only if it implies an email was sent; leave it if accurate"
    status: completed
  - id: p0-audit-status
    content: "B1+B2: Append 'Status at HEAD c443aac' to docs/AUDIT-2026-08-22.md - mark 4.5 resolved via b6c7516, list findings still present, and record corrected metrics (88/53/10/25, 43 migrations, 4106 lines, 62 validators)"
    status: completed
  - id: p0-audit-new
    content: "B3+B4: Add new findings (staff chat attachment paths, listStaffDirectory omitting manager, the comms gap) plus the manager role and the RBAC positives that must not be regressed"
    status: completed
  - id: p0-scaffold
    content: "C1+C2: Create docs/WORKLOG.md with the Phase 0 entry, docs/plans/ with README and _TEMPLATE.md, and copy this micro-plan in as phase-00-audit-refresh.md"
    status: completed
  - id: p0-node
    content: "C3: Add .node-version (22.23.2) and an engines field to package.json requiring node >=22.12.0"
    status: completed
  - id: p0-verify
    content: "Verify: tsc --noEmit clean, rg finds no remaining delivery claims, manual sweep of all six toast sites as owner on localhost:8080, confirm portal messages still write"
    status: completed
  - id: p0-close
    content: Commit in three parts (copy fix, docs refresh, scaffolding), append the work log entry, then mark phase-0 completed in the master plan
    status: completed
isProject: false
---

# Phase 0 Micro-Plan — Audit refresh and emergency copy fix

**Parent:** Aetheria Remediation Master Plan, Phase 0
**Depends on:** nothing
**Blocks:** Phase 1 (foundation), and the work log convention every later phase uses
**Estimated effort:** 3-4 hours
**Risk:** very low. Copy, docs and one dotfile. No schema, no auth, no behaviour.

## Why this is first

Staff are currently told consent reminders and payment chases were delivered to a patient's email or phone. They were not — the code writes an in-app portal message and then names the address in the success toast. Patients arrive without signed consent and with unpaid deposits, and nobody knows why because the system reported success.

That is a clinical and financial risk that costs a few hours to remove, and it does not depend on any of the twelve phases that follow. It ships today.

## Preconditions

- On `main`, up to date with `origin/main` at `c443aac`, clean tree.
- Dev server on Node 22: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && npm run dev`.
- Confirm no other server is running, or Vite silently falls back to port 8081 on the wrong Node.

## Task group A — Truthful delivery copy (9 sites)

The rule: describe what actually happens, which is a message in the patient's portal thread. Do not say "sent to <address>", and do not name a channel that is not wired.

### A1. Consent reminder toasts (2 sites)

`src/components/dashboard/today-snapshot.tsx:871` and `src/routes/_authenticated/schedule.tsx:1236`

```javascript
// current - target is the patient's email address or mobile number
{ onSuccess: () => toast.success(`Consent reminder sent to ${target}`) },
// change to
{ onSuccess: () => toast.success("Consent reminder posted to their patient portal") },
```

### A2. Payment and deposit toasts (2 sites)

`src/components/dashboard/today-snapshot.tsx:946` and `src/routes/_authenticated/schedule.tsx:1049`

```javascript
// current
{ onSuccess: () => toast.success(`${label} sent to ${target}`) },
// change to
{ onSuccess: () => toast.success(`${label} posted to their patient portal`) },
```

### A3. Document toasts (2 sites)

`src/routes/_authenticated/patients.$id.tsx:145` and `:154`

- `toast.success("Sent to patient")` becomes `toast.success("Consent form issued - it is now in their portal")`
- `toast.success("Reminder sent")` becomes `toast.success("Reminder posted to their portal")`

Both back `sendDocument`/`resendDocument`, which only write DB rows.

### A4. Booking dialog static copy (3 sites)

`src/routes/_authenticated/schedule.tsx:798`, `:836`, `:840`

- `:798` "Confirmation is sent by email and text with a full payment link." becomes "Confirmation and payment link are saved to their patient portal."
- `:836` ". Confirmation is still sent by email and text." becomes ". Confirmation is still saved to their portal."
- `:840` "After booking, confirmation goes by email and text with a" becomes "After booking, confirmation goes to their patient portal with a"

### A5. `bookingNotifyDescription()`

`src/lib/payment-link.ts:84-95`. This helper is the root of the booking claim — it interpolates the email and phone into "sent by email (x) and text (y)". Collapse it to describe the portal only, and add a short comment stating that email and SMS dispatch arrives in Phase 9, so the claim is not reinstated by the next developer.

### A6. Misleading source comment

`src/lib/clinic.functions.ts:959` reads "Confirmation + payment link for email/text (and portal thread)". Correct it to portal-only.

### A7. Verify, do not assume

`src/components/invite-staff-dialog.tsx:98` says "Invitation created", which is **accurate** — an account is created and the manager shares the temporary password by hand. Read the surrounding dialog copy and only change it if it implies an email went out. Do not change a correct string.

## Task group B — Audit refresh

Amend `docs/AUDIT-2026-08-22.md`. Append a new section rather than rewriting findings, so the document stays a reviewable trail.

### B1. New section "Status at HEAD `c443aac`"

- 4.5 staff notifications: **resolved** in commit `b6c7516`, now scoped by `recipient_id` at [clinic.functions.ts:1368](src/lib/clinic.functions.ts).
- Still present: 4.2, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9, 8.2.
- 8.2 partially changed: manager-set passwords and a forced-change gate were added; self-service reset is still absent.

### B2. Corrected metrics

The audit's "~40 of 75 handlers" was an estimate. Measured at HEAD: **88 handlers, 53 guarded, 10 self-scoped by `userId`, 25 genuinely open.** Record the tier breakdown from master plan section 1. Also update: 43 migrations, `clinic.functions.ts` 4,106 lines, 62 validators, schedule.tsx 2,344 lines.

### B3. New findings the audit predates

- Staff chat attachment paths are client-supplied and unverified in `sendStaffChatMessage` — same class as `addPhoto` in 4.6.
- `listStaffDirectory` filters roles to `["owner","practitioner","front_desk"]` at [clinic.functions.ts:1408](src/lib/clinic.functions.ts), omitting `manager`, so managers can be missing from alert recipient lists. Functional bug, not just cosmetic.
- The whole of master plan section 4: the comms layer is absent while the UI claims delivery.

### B4. Role model and positives

Record the fifth `manager` role. Also record what is **good**, so it is not "fixed" later by mistake: `role_permissions` RLS is correctly `is_owner()`-gated, `user_roles` prevents an owner removing their own role, and `setRolePermission` validates against an allowlist and audits.

## Task group C — Conventions and scaffolding

### C1. `docs/WORKLOG.md`

Append-only. Header explaining the convention, then the Phase 0 entry as the first record and the worked example of the format: date, phase, commits, changed, verified, deferred, residual risk.

### C2. `docs/plans/`

Create the directory with `docs/plans/README.md` describing the loop (micro-plan, approve, build, verify, work log, update master), plus `docs/plans/_TEMPLATE.md`. Copy this micro-plan in as `docs/plans/phase-00-audit-refresh.md` so the repo holds the permanent record rather than only the Cursor plan file.

### C3. `.node-version`

Containing `22.23.2`. Also add an `engines` field to `package.json` (`"node": ">=22.12.0"`), matching what `@tanstack/start-storage-context` already requires. This is the fix for the WebSocket failure that cost time today; without it the next developer hits the same wall.

## Verification

1. `npx tsc --noEmit` clean.
2. `rg -n 'sent to \$\{|by email and text|Reminder sent|Sent to patient' src` returns **zero** results in the touched files.
3. Manual, logged in as owner on `localhost:8080`: dashboard consent chip Email and Text both toast "posted to their patient portal"; the same on the diary payment chip; patient record Send form and Remind both show portal wording; the booking dialog shows no email/text claim.
4. Confirm the underlying behaviour is untouched: a message row still appears in the patient's portal thread after each action.
5. `docs/` renders correctly on GitHub after push, including the new section anchors.

## Commits

Three, so the copy fix can be reverted independently of the docs:

1. `fix: describe portal-only delivery instead of claiming email and SMS were sent`
2. `docs: refresh audit against HEAD c443aac with corrected counts and new findings`
3. `chore: add work log, micro-plan convention and Node 22 pin`

## Rollback

Copy-only changes; `git revert` of commit 1 restores prior strings with no data or schema impact.

## Out of scope

No actual email or SMS sending (Phases 7-9). No authorization changes (Phases 1-3). No handler edits beyond the single comment in A6. If a genuine bug surfaces while editing these files, record it in the audit's new section rather than fixing it here.

## On completion

Append the Phase 0 work log entry, then set `phase-0` to completed in the master plan and confirm Phase 1 preconditions.
