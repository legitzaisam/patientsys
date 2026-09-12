# Phase 7 — Comms schema and outbox

**Parent:** Aetheria Remediation Master Plan, Phase 7
**Depends on:** Phase 3 (complete — `comms.send` exists), Phase 5 (complete — clinic isolation + write-grant revoke)
**Blocks:** Phase 8 (adapters drain this table), Phase 9 (real flows call `enqueueCommunication`)
**Risk:** medium. A wrong default on marketing consent is a PECR breach; a wrong recall rename leaves staff thinking a task is an email receipt. Nothing actually leaves the building in this phase.

## Why this is next

Phases 3 and 5 gave us a send capability and a tenancy model. There is still nowhere to put an email or text. `message_templates` are UI-only. `retention_outreach` is a handwritten contact log. `recall_tasks.status = "sent"` means "task assigned", which is the same class of lie Phase 0 removed from the toasts.

Phase 8 cannot dispatch, and Phase 9 cannot wire consent or booking mail, until there is one durable write path and a place that records whether the patient asked not to be contacted.

Phase 6 is still open (dashboard SMTP / apply `20260910000000`). That does not block this phase: Auth mail is not our outbox.

## What research changed

**Prefs live on `patients`, not a new table.** One row per patient, least ceremony, inherits existing clinic scoping. Defaults: `reminders_opt_in` true (transactional reminders are opt-out); `email_opt_in`, `sms_opt_in`, `marketing_opt_in` false (PECR opt-in); `unsubscribed_at` null.

**`purpose` is an extra column the master plan did not list.** Enqueue has to know which consent rule applies. Values: `transactional` | `reminder` | `marketing`. Without it Phase 8 would guess, and guessing consent is how you get a fine.

**Recall `sent` → `open` via `ALTER TYPE ... RENAME VALUE`.** Postgres can rename an enum value in place. The UI label becomes "Open". Document `status = "sent"` stays — that still means a form was issued.

**`retention_outreach` stays a manual contact log.** It is not a delivery receipt. Optional `communication_id` so Phase 9 can link a phone note to a queued send. No status column — that would duplicate the outbox.

**Reads are `staffOrOwnPatient` with `comms.send` on the staff side.** The master plan said "staff read, gated on `comms.send`". Patients also need to see (and change) their own preferences, and seeing their own outbox is the PECR-honest thing. They cannot enqueue.

**No compose UI.** `enqueueCommunication` is a server function so Phase 8/9 and the policy check can see it. Staff see the log (empty, or demo fixtures). Wiring `sendDocument` / recall mailto / booking copy is Phase 9.

**Migration apply will likely fail from this machine** the same way Phase 6 did (`db.*.supabase.co` has no IPv4). The file still belongs in `supabase/migrations/`. Until it is applied, live enqueue errors; demo mode does not need it.

## Preconditions

- Phase 3 policy map and `comms.send` seed are in place.
- Phase 5 `clinic_isolation` + default-privilege revoke are in place, so a new table does not quietly re-grant `anon` writes.
- Do not edit applied migrations. New file only: `20260911000000_comms_outbox.sql`.

## Task group A — Durable store

### A1. `communications` table

`supabase/migrations/20260911000000_comms_outbox.sql`

Enums `communication_channel` (email/sms), `communication_status` (queued/sending/sent/failed/bounced), `communication_purpose` (transactional/reminder/marketing). Columns match the master plan plus `purpose`. Drain index on `(status, scheduled_for)`. Patient log index on `(clinic_id, patient_id, created_at desc)`.

RLS: staff SELECT via `is_staff()`; patients SELECT their own rows; no INSERT/UPDATE/DELETE policies for `authenticated` or `anon`. Explicit `REVOKE` of writes. `clinic_isolation` RESTRICTIVE policy, same shape as Phase 5.

### A2. Patient preference columns

Same migration. Five columns on `patients`. Existing rows get the defaults above.

### A3. Recall semantics

Same migration: `ALTER TYPE recall_task_status RENAME VALUE 'sent' TO 'open'`. Then every TS/UI/demo site that treats recall status `"sent"` as "not yet contacted" becomes `"open"`. Document status `"sent"` is untouched.

### A4. Outreach is a log

`retention_outreach.communication_id` nullable FK. Comment on `logRetentionOutreach` that a row here is "we spoke / we opened mailto", not "the provider accepted the message".

### A5. Types and tenancy

Hand-edit `src/integrations/supabase/types.ts` (same as Phase 6). Add `communications` to `CLINIC_SCOPED_TABLES`. Pref columns inherit `patients`.

## Task group B — Single write path

### B1. Consent rules

`src/lib/comms/preferences.ts` — shared, no `.server`, so the UI can explain a refusal.

- **marketing:** require `marketing_opt_in`, the channel flag (`email_opt_in` / `sms_opt_in`), and no `unsubscribed_at`.
- **reminder:** require `reminders_opt_in` and no `unsubscribed_at`.
- **transactional:** allow if an address exists (consent magic links, booking confirmations that are part of the service).
- Missing `to_address` (and no patient email/phone to fill it) refuses.

Saving prefs: if marketing and reminders are both off, set `unsubscribed_at` (keep the existing timestamp if already set). If either is on, clear it.

### B2. `enqueueCommunication()` helper

`src/lib/comms/enqueue.server.ts` — the only insert into `communications`. Loads the patient, resolves the address, runs B1, inserts `status = queued`. Phase 8 drains this table; nothing else writes it.

### B3. Handlers

| Handler | Policy | Input |
|---|---|---|
| `enqueueCommunication` | `{ kind: "capability", key: "comms.send" }` | patient, channel, purpose, body, optional subject/template/address/schedule/related |
| `listCommunications` | `{ kind: "staffOrOwnPatient", staffKey: "comms.send" }` | `patient_id` |
| `saveCommsPreferences` | `{ kind: "staffOrOwnPatient" }` | `patient_id` + four booleans |

Zod schemas. Demo twins. `authorize()` + `audit()` on the prod handlers.

## Task group C — Reachable surfaces

Phase 5's lesson: a column nobody can toggle is not a preference.

### C1. Prefs card

`src/components/comms/comms-preferences.tsx` — four switches, glass, no left accent rail. On the patient record (any staff who can open it) and on `/my-record`.

### C2. Outbox log

`src/components/comms/comms-log.tsx` — recent rows for that patient. Staff need `comms.send`. Patients see their own. Empty copy says nothing has been sent yet, which is true.

### C3. Recall labels

`follow-up-tasks.tsx`, `recall-tasks-panel.tsx`: "Sent" → "Open". Undo from contacted returns to `open`.

## Verification

1. `npm run check:policy` → every handler still mapped (expect 95, was 92).
2. `npm run check:validators` → field coverage holds (expect 67, was 64).
3. `npm run check:tenancy` → `communications` classified; 30 clinic-scoped tables.
4. `npx tsc --noEmit` → at or below the Phase 6 baseline of 49.
5. Demo, as owner, open a patient → prefs save; outbox shows the fixture; toggling marketing off is stored.
6. Demo, as patient on `/my-record` → same prefs card; cannot enqueue.
7. Demo dashboard "My tasks" → open tasks say Open, not Sent; Mark contacted still works.
8. Confirm `send-recall-dialog` still opens `mailto:` / `sms:` (Phase 9). Confirm `sendDocument` still does not insert into `communications`.

## Commits

Split along revert lines if asked to commit (not part of this phase unless asked):

1. `feat: add communications outbox schema and patient comms preferences`
2. `feat: enqueueCommunication helper and comms handlers`
3. `fix: rename recall task status sent to open`

## Rollback

Revert the three commits. Drop the migration only if it has not been applied. If it has: `DROP TABLE communications`, drop the three enums, drop the five patient columns and `retention_outreach.communication_id`, `ALTER TYPE recall_task_status RENAME VALUE 'open' TO 'sent'`. Applied enum rename is reversible the same way. Existing recall rows survive.

## Out of scope

- Resend / Twilio / SPF / DKIM / drain / webhooks / sandbox dispatch — Phase 8.
- Consent magic links, booking mail, reminders cron, deposit chase, recall replace-mailto, staff invite mail, template interpolation, public unsubscribe route — Phase 9.
- Portal invitations — Phase 10.
- Phase 6 leftovers (dashboard SMTP, apply `20260910000000`, service-role JWT spike).
- SAML, domain allowlists, rewriting `sendMessage` (in-app chat stays on `messages`).

## On completion

Append `docs/WORKLOG.md`, set Phase 7 complete in the master plan, confirm Phase 8 still only needs this table and the helper.
