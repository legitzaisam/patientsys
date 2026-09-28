# Phase 4: server functions — pattern requests, dashboard staff requests, invoice on behalf

Branch `e2e_live`, on top of `0293ca9`. 29 Sep 2026. Production in `clinic.functions.ts`, demo twins in `clinic.functions.demo.ts`, schemas in `schemas.ts`, POLICY rows in `policy.ts`. Every handler calls `authorize()` (`check:policy` 184 handlers).

### r2-p4-01-pattern-request-fn

- `requestWorkingPatternChange({ rows?, note? })` — validator and `schemas.RequestWorkingPatternChange` change together (`rows` = the seven-row `patternRows` schema shared with `SetWorkingPattern`, `note` optional; the handler insists on at least one — a `.refine()` would have broken `check-validators`' `z.object({` regex). With `rows`: `assertPatternRows`; `samePattern(current, proposed)` → "Those are already your hours."; owner / software admin → `writeWorkingPattern` straight away, `{ applied: true }`; otherwise `closePendingPatternRequests(… "withdrawn", "Replaced by a newer request")`, insert pending with `requires_owner = profileChangeRequiresOwner(identity)`, notify the approvers — `profileManagerIds(…, { ownersOnly: true })` when `requires_owner`, else owners + admins + managers holding the key — with `patternChangeSummary(current, proposed)` ("Thu 09:00–17:00 (was 12:00–20:00)"), audit `staff.pattern_requested`. Without `rows` the note-only notification stays as before.
- `src/lib/staff-schedule.ts` (pure): `samePattern`, `patternChanges`, `patternChangeSummary`, `patternRowsFromJson` (tolerant of malformed jsonb), `PatternRequestLike`. Tests added to `tests/unit/staff-schedule.test.ts` (2).

### r2-p4-02-pattern-review-fns

- `writeWorkingPattern(ctx, supabaseAdmin, userId, rows)` — the one write (validate, delete, insert) both the direct edit and an approval go through; `setWorkingPattern` uses it and then marks the person's pending request withdrawn ("Superseded by a direct change").
- `withdrawWorkingPatternChange({ id })` — own pending only.
- `reviewWorkingPatternChange({ id, approve, reviewerNote? })` — `managerCapability team.manage_profiles`; `requires_owner` rows for owner / admin only; nobody reviews their own; approve writes the seven rows and audits `staff.pattern_set { via: "request", requestId }`, decline audits `staff.pattern_declined`; the requester gets `pattern_reviewed` ("Maya Chen approved your new hours (Thu 09:00–17:00 (was 12:00–20:00)). "Fine by me"").
- Demo twins mirror all of it on the in-memory `staffPatternRequests` table (typed `DemoPatternRequest`, no `any`).

### r2-p4-03-schedule-returns-request

- `getStaffSchedule` returns `patternRequest` — the latest pending row with `rows` (parsed), `note`, `requires_owner`, `requested_at` and a ready `summary` — for yourself or a viewer with `canManageProfiles`; `null` for the front desk.

### r2-p4-04-attention-staff-requests

- `staffRequestAttentionItems({ patternRequests, timeOff, nameOf }, viewer)` in `profile-change-policy.ts`: one `staff_request` item per pending working-pattern or time-off request, skipping the viewer's own and, unless the viewer is the owner / admin, any `requires_owner` row; `title` "Dr Tom Whitfield — working pattern" / "— time off", `subtitle` the summary or "Holiday · 1 working day · Fri 30 Oct", `href` `/team/<id>?tab=schedule`. `tests/unit/staff-requests.test.ts` (3).
- `getDashboard` (production and demo): when `canManageProfiles(identity)`, loads pending pattern requests, pending time off and staff names, builds the current pattern per requester, and pushes the items before the profile-change ones.

### r2-p4-05-invoice-on-behalf

- `createPractitionerInvoice({ userId?, … })`: target = `userId ?? caller`; a colleague's invoice needs `canSetCommission`; the number, share maths and row are the target's; when raised on behalf the practitioner is told (`invoice`: "Dr Amara Osei scheduled your September 2026 invoice · £13,812.75 · to the clinic owner on 1 Oct 2026." / "… raised … sent to payroll."); the store's `notifyOwners` skips the creator as well as the practitioner.
- `sendInvoiceNow` now passes `invoiceDocumentHtml(buildInvoiceDocument(...))` as the email's `html` alternative (issued = send day, bill-to = clinic + Payroll team / Clinic owner + the recipient address).

### r2-p4-06-policy-schemas-guards

- POLICY: `withdrawWorkingPatternChange: staff`, `reviewWorkingPatternChange: managerCapability team.manage_profiles`. Schemas: `RequestWorkingPatternChange` (rows?, note?), `WithdrawWorkingPatternChange`, `ReviewWorkingPatternChange`, `CreatePractitionerInvoice.userId` optional.
- `check:policy` ok (184), `check:validators` only the two pre-existing `saveAppointment` problems, `check:tenancy` ok (59).

### r2-p4-07-verify-commit

| Persona probe (demo, server-function calls) | Result |
| ------------------------------------------- | ------ |
| Practitioner (Nadia) | `{}` → "Propose new hours or say what should change."; proposal → pending, 3 approvers told, `getStaffSchedule().patternRequest` set; reviewing her own → "You do not have access to this area"; raising Tom's invoice → "You do not have access to raise another person's invoice"; withdraw once ok, twice → "Only your own pending requests can be withdrawn."; dashboard has no `staff_request` items |
| Front desk | `patternRequest: null`, `canManage: false`; review refused; no dashboard items |
| Manager (keys on) | dashboard: Tom — working pattern, Nadia — time off, Sofia — time off; Nadia's summary "Thu 09:00–17:00 (was 12:00–20:00)"; approve → Nadia's Thursday is 09:00–17:00 and `patternRequest` is null; her own proposal lands with `requires_owner: true` and only the owner is told |
| Owner | same three dashboard items; declines Tom's with a reason; raises Nadia's September invoice on her behalf (`INV-NR-2026-09`, scheduled for 1 Oct, £13,812.75, 133) and Nadia is notified; owner's own new Saturday hours apply directly (`applied: true`) |
| Notifications | owner sees `pattern_change` for Maya (owner-only) and Nadia; Nadia sees `pattern_reviewed` and the on-behalf `invoice` line |

| Check | Result |
| ----- | ------ |
| Unit | 214 passed (+5), the 11 pre-existing failures unchanged |
| tsc | 109 = baseline (0 new) |
| Lint | delta 0 on both function files, `invoices.server.ts`, `staff-schedule.ts`, `profile-change-policy.ts`, `schemas.ts`, `policy.ts`, the tests. A whole-file Prettier run on the demo file was reverted to my hunks only |

Files: `src/lib/clinic.functions.ts`, `src/lib/clinic.functions.demo.ts`, `src/lib/invoices.server.ts`, `src/lib/staff-schedule.ts`, `src/lib/profile-change-policy.ts`, `src/lib/validation/schemas.ts`, `src/lib/auth/policy.ts`, `tests/unit/staff-schedule.test.ts`, `tests/unit/staff-requests.test.ts` (new).
