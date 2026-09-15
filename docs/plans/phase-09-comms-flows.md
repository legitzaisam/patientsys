# Phase 9 Micro-Plan — Wire comms to real flows, behind a real regression suite

**Parent:** master plan, Phase 9
**Depends on:** Phase 8 (adapters, drain, webhooks), Phase 4 (zod validators), Phase 3 (`comms.send`)
**Blocks:** Phase 10 (portal invitations reuse the enqueue + template machinery)
**Risk:** medium. Two new public unauthenticated routes (consent signing, unsubscribe) and the first
phase where staff actions genuinely leave the building once sandbox is off.

## Why this went next

Phases 7 and 8 built a working pipe — outbox, PECR rules, Resend/Twilio adapters, drain, webhooks —
and nothing called it. Every patient-facing flow still wrote an in-app portal message only, and the
recall dialog handed off to `mailto:`. Meanwhile the codebase had no test runner at all: zero test
files, no CI. This phase locked current behaviour in a regression suite first, then wired the flows.

## Task group A — Regression suite (baseline before behaviour moves)

- **A1. Vitest 5** (`vite ^8` support) with `tests/unit/`: PECR truth table, dispatch
  claim/backoff/fail, backoff cap, webhook signatures, payment-link builders, `can()`,
  `resolveScope`, and later the templates, reminder-times and unsubscribe HMAC modules.
- **A2. Playwright** on demo mode, port 8091, `workers: 1` (the fixture layer is one shared
  in-memory state), `reuseExistingServer: false` (one run's writes must not leak into the next).
  `e2e/fixtures.ts` sets the `demo_role` cookie so tests never touch `/auth`. Baseline specs:
  smoke (all routes × 4 roles), rbac, schedule, patients, documents, comms, retention, portal, team.
- **A3. One gate:** `npm run verify` = `check:policy` + `check:validators` + `check:tenancy` +
  `test:unit` + `test:e2e`, plus `.github/workflows/verify.yml`. Lint runs non-blocking in CI
  (pre-existing repo-wide debt is Phase 11).

## Task group B — Consent magic link

- **B1. Migration `20260914000000`:** unique index on `documents(access_token)`, `cancelled` on
  `communication_status`, `document_access_events` (consent evidence + per-IP throttle source).
- **B2. `src/lib/documents/access.server.ts`:** resolve/sign by token. Uniform `not_found` for
  unknown, malformed and expired tokens; `signed` is the one distinct outcome. Single-use on sign is
  the Phase 5 immutability trigger, not just application code. Demo twin over the fixtures.
- **B3. Public routes:** `/d/$token` page + `/api/documents/access/$token` GET/POST. First open
  stamps `viewed_at` and moves `sent → viewed`; signing records name, IP and user agent.
- **B4. `sendDocument` / `resendDocument`** enqueue a transactional email (`consent_request`) with
  the signing URL, set a 14-day `expires_at`, and keep the portal message. Resend gains the portal
  message its toast always claimed, and an optional SMS channel used by the consent chips.

## Task group C — Transactional flows

- **C1. `src/lib/comms/templates.ts`:** `renderTemplate` (shared with the recall dialog and message
  composer previews), `channelsFor` (email when on file; SMS added for reminders, or as fallback),
  and the message builders (consent, booking update, reminder).
- **C2. Bookings:** `saveAppointment` enqueues the confirmation it already built; the update path
  and `rescheduleAppointment` send a reschedule notice — only when the time actually changed.
- **C3. Payments:** new `sendPaymentRequest` handler (deposit / full / balance / receipt), message
  built server-side; both payment chips point at it. Refusals throw so the staff toast tells the
  truth instead of downgrading to portal-only.
- **C4. Recall:** new `sendRecall` handler replaces `mailto:`/`sms:` — a **marketing** send under
  PECR, so it respects opt-ins — and stamps `retention_outreach.communication_id`.
- **C5. Staff invites:** `inviteUserByEmail` (Supabase Auth sends the mail) with a recovery-link
  fallback for existing accounts. No plaintext temporary password is generated, returned or shown.
- **C6. Copy:** `bookingNotifyDescription(queued)` reports the channels actually queued; document
  toasts report whether the link was emailed; booking-dialog copy updated.

## Task group D — Reminders, unsubscribe, trail

- **D1. Migration `20260915000000`:** `clinics.reminder_offsets` (default `{168,24}`), `call` on
  `communication_channel`, `message_templates.key` (unique per clinic where set).
- **D2. Reminders** are enqueued at booking with future `scheduled_for` (`reminderTimes` skips
  offsets already past); the Phase 8 drain sends them — no new scheduler. Reschedule and cancel set
  pending rows to `cancelled` and (for reschedules) requeue.
- **D3. Unsubscribe:** stateless HMAC tokens (`COMMS_UNSUBSCRIBE_SECRET`), a footer appended to
  non-transactional email at dispatch, public `/u/$token` page with POST-only apply.
- **D4. Trail:** click-to-dial logs a `call` row (status `sent`, never claimable); the outbox card
  names what each row was about from its template key.

## Verification

1. `npm run verify` → green: 3 static checks, 77 unit tests, 58 Playwright tests.
2. `check:policy` 101 handlers (was 96); `check:validators` 71 (was 67); `check:tenancy` 32 tables.
3. `npx tsc --noEmit` 59 (baseline before the phase: 64).
4. Migrations `20260914000000` and `20260915000000` applied to the remote (ledger 57 applied).
5. Demo walk-through: issue consent → queued transactional row → Process queue → `sent`/`sandbox`;
   open `/d/$token` signed-out → sign → replay refused; recall email against an opted-out patient →
   refused with the PECR reason and no row queued; `curl -X POST /api/comms/drain` → 401.

## Commits

1. `15fa93b` test: add unit and end-to-end regression suites
2. `6de007c` feat: email consent documents with a public signing link
3. `f8eabfb` feat: send bookings, deposits, recall and staff invites for real
4. `11fe955` feat: schedule appointment reminders and handle unsubscribes

## Rollback

Revert the four commits in reverse order. The migrations are additive (index, enum values, columns,
one table); enum values cannot be dropped, which is harmless — nothing writes `cancelled` or `call`
after a revert. `document_access_events` rows are evidence and should be kept even then.

## Out of scope

pg_cron scheduling (dashboard step from Phase 8), SPF/DKIM/DMARC, real telephony, portal
invitations linking `patients.user_id` (Phase 10), live-Supabase E2E, repo-wide lint (Phase 11),
and server-side rendering of staff-authored `message_templates` by key — staff sends still submit
the rendered body; the `key` column and registry exist for system templates.

## On completion

Work log appended (with entries recovered for Phases 6 and 7), Phase 9 complete in the master plan.
