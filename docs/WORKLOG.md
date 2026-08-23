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
