# Phase 8 — Provider adapters

**Parent:** Aetheria Remediation Master Plan, Phase 8
**Depends on:** Phase 7 (outbox + `enqueueCommunication` + PECR prefs). Phase 7's migration may still be unapplied; demo does not need it.
**Blocks:** Phase 9 (real flows call enqueue; this phase is what actually leaves the building)
**Risk:** medium. A live key with no sandbox flag sends real mail from a drain. A webhook that trusts an unsigned POST lets anyone mark a consent reminder delivered.

## Why this is next

Phase 7 can queue. Nothing claims those rows. Consent reminders, booking mail and recall texts in Phase 9 would still be fiction unless a dispatcher exists and a bounce can come back.

The Phase 0 toasts were a lie because there was no transport. This phase is the transport. It still does **not** wire `sendDocument`, bookings or recall `mailto:` — that is Phase 9, so we can prove the pipe before we point clinical flows at it.

## What research changed

**Drain is an HTTP route on this app, not an Edge Function.** There is no `supabase/functions/` tree and we will not add one. TanStack Start already serves `createFileRoute` server handlers. `pg_cron` + `pg_net` call `POST /api/comms/drain` with a shared secret. That matches the master plan's recommended drain and keeps one deploy surface.

**Do not auto-schedule the cron in the migration.** The job needs a production URL and `COMMS_DRAIN_SECRET`. A migration that fires at a placeholder would 404 forever. The migration ships the `claim_queued_communications` RPC (`FOR UPDATE SKIP LOCKED`). The cron SQL lives in this plan as a dashboard step.

**No new npm packages.** Resend and Twilio both have a one-call HTTP API. Fetch keeps the dependency freeze the master plan asked for.

**Sandbox marks the row sent.** "Write to the outbox and log instead of dispatching" would leave drain untestable and the log stuck on queued. Sandbox claims the row, logs destination (not body), and writes `provider = sandbox`. Nothing leaves the building. Demo is always sandbox. Live is sandbox when `COMMS_SANDBOX=1` or the channel's key is missing.

**Staff can run the drain.** Phase 5's lesson: unreachable machinery is not a feature. `drainCommunications` is a `comms.send` handler. The outbox card gets Process queue. The HTTP route is what cron uses.

**Webhooks fail closed.** Missing signing secret → 401. Demo has no webhooks; sandbox rows never get a provider id from Resend/Twilio.

**Backoff reuses `scheduled_for`.** No new column. Failed send: `status = queued`, `scheduled_for = now() + min(15 * 2^(attempts-1), 3600)s`. After 8 attempts: `failed`. Rows stuck in `sending` for 5 minutes are reclaimable.

**SPF/DKIM/DMARC is a dashboard step**, same class as Phase 6 SMTP. Code cannot do DNS.

## Dashboard steps that code cannot do

1. **Resend** — API key, verify the clinic domain, copy the DNS records (SPF, DKIM, DMARC). Until the domain is verified, live mail lands in spam and looks like the feature works.
2. **Twilio** — account SID, auth token, UK alphanumeric sender ID (or a UK number). Request the sender ID; it is not instant.
3. **Env on the host:** `RESEND_API_KEY`, `COMMS_FROM_EMAIL`, `COMMS_FROM_NAME`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `COMMS_DRAIN_SECRET`, `RESEND_WEBHOOK_SECRET`, `APP_ORIGIN`. `COMMS_SANDBOX=1` until those are real.
4. **Webhook URLs** in each provider dashboard: `{APP_ORIGIN}/api/comms/webhooks/resend`, `{APP_ORIGIN}/api/comms/webhooks/twilio`.
5. **Apply `20260911000000` then `20260912000000`.** Same IPv4/pooler issue as Phase 6. Until then live drain falls back to a non-locking select (fine for one clinic, racy under two drains).
6. **Cron** (after the app is reachable): enable `pg_cron` and `pg_net`, then:

```sql
select cron.schedule(
  'comms-drain',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.comms_drain_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.comms_drain_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Set the two GUCs to the production origin and secret first. Do not point this at localhost.

## Task group A — Adapters

### A1. Email

`src/lib/comms/email.server.ts` — `POST https://api.resend.com/emails`. From: `COMMS_FROM_EMAIL` / clinic name. Returns `{ provider, messageId }` or an error string. Sandbox: log `to` + subject, return `sandbox:<uuid>`.

### A2. SMS

`src/lib/comms/sms.server.ts` — Twilio Messages API, `From` = `TWILIO_FROM`. Same result shape. Sandbox: log `to`, no body.

### A3. Dispatch

`src/lib/comms/dispatch.server.ts` — claim due rows, call A1/A2, write `provider`, `provider_message_id`, `sent_at`, `status=sent` or bump `attempts` / `error` / backoff. Shared by the HTTP drain and the staff handler.

## Task group B — Drain and webhooks

### B1. Claim RPC

`supabase/migrations/20260912000000_comms_drain.sql` — `claim_queued_communications(_limit)` `SECURITY DEFINER`, execute for `service_role` only. No client writes.

### B2. HTTP drain

`src/routes/api.comms.drain.ts` — `POST`, `Authorization: Bearer $COMMS_DRAIN_SECRET`. 401 if the secret is missing or wrong. No JWT. Uses the admin client unscoped (this is the one process that must see every clinic).

### B3. Staff drain

`drainCommunications` in `clinic.functions.ts` + demo twin. Policy `{ kind: "capability", key: "comms.send" }`. Clinic-scoped claim (no global RPC). Zod not needed (no input).

### B4. Webhooks

`src/routes/api.comms.webhooks.resend.ts` and `...twilio.ts`. Verify signatures. Map delivered → `sent`, bounce/undelivered → `bounced`/`failed`. Look up by `provider_message_id`.

## Task group C — Reachable sandbox

### C1. Outbox card

`comms-log.tsx` — show provider / attempts / error. Process queue for staff with `comms.send`. Copy stops saying the outbox is disconnected.

### C2. Demo

Demo drain walks the in-memory array through the same sandbox adapters. The Olivia queued fixture becomes `sent` + `sandbox` when you press Process queue.

## Verification

1. `npm run check:policy` → 96 handlers (was 95).
2. `npm run check:validators` → 67 (drain has no input).
3. `npm run check:tenancy` → still 30 tables. `clinic.functions.ts` raw `supabaseAdmin` count unchanged (drain lives in `.server.ts`).
4. `npx tsc --noEmit` → at or below 49.
5. `curl -X POST localhost:8080/api/comms/drain` → 401.
6. Demo, owner, Olivia: Process queue → row becomes **sent**, provider **sandbox**. Nothing hits Resend.
7. Confirm `send-recall-dialog` still uses `mailto:` / `sms:` (Phase 9). `sendDocument` still does not enqueue.

## Commits

1. `feat: add Resend and Twilio adapters with sandbox dispatch`
2. `feat: drain communications outbox and provider webhooks`

## Rollback

Revert the two commits. Drop `claim_queued_communications` if the migration applied. Unschedule `comms-drain` if you created it. Rows already marked `sent` by sandbox stay; they were never delivered.

## Out of scope

- Wiring `sendDocument`, bookings, reminders cron offsets, deposit chase, recall replace-mailto, staff invite mail, template interpolation, public unsubscribe — Phase 9.
- Phase 6 leftovers (SMTP, apply `20260910000000`).
- Phase 7 apply leftover (`20260911000000`).
- Edge Functions. Real telephony. New npm SDKs.

## On completion

Append the work log, set Phase 8 complete, confirm Phase 9 still only needs enqueue + a live (or sandbox) drain.
