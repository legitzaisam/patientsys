# Offers and marketing: stage-based offers, templates and sends — work log

Workstream 3 of the feedback round (feedback pages 3 and 8-9), the last of the three plans. Branch `e2e`, built on top of `4d44fe9`.

Decisions taken with the client before building: the marketing surface is gated by a **new `offers.manage` capability** (the owner always holds it; grantable to any role from the Team access matrix; no new role); stage automation is **on/off per stage, off by default**, sending on the daily outbox run with a "who would receive this today" preview and no approval queue.

## The model, in one place

```
Pre-consultation     signed up, nothing booked, never consulted           delay 0d
Post-consultation    consulted, nothing booked, no plan                   delay 7d
Single treatment     one non-consultation treatment, nothing booked       delay 21d
Plan ending          active plan, 3+ sessions, ≤1 left or >80% duration   delay 0d
```

`offer_templates` is what the clinic designs (one live template per stage plus any number of `custom` one-offs). `patient_offers` is what each patient was sent: a snapshot of the copy, the source (`automation` / `one_off` / `bulk` / `insights`), and `sent → viewed → claimed` (or `expired` / `cancelled`). Delivery goes through the existing `communications` outbox with `purpose = marketing`, so PECR consent, the unsubscribe footer and the sandbox adapters apply unchanged. The portal card reads `patient_offers` directly, so a patient without marketing-email consent can still be given (and claim) an offer from their record, and the dialog says so before Send.

Automation runs at the start of every outbox drain (`drainDueCommunications` for the cron route and the staff "Process queue"; the demo twin in `drainCommunications`): for each enabled stage template, today's cohort minus anyone already offered that stage, minus anyone inside the delay, minus anyone without marketing consent. Automation never creates a portal-only card. A partial unique index on `(patient_id, stage) where source = 'automation'` makes a concurrent second run a no-op.

## Phase 0 — schema, permission, rules, fixtures

| File | Change |
|---|---|
| `supabase/migrations/20260926000000_offers.sql` | `offer_templates` (stage, copy, value/code/CTA, `valid_days`, email/SMS/portal flags, `automation_enabled`, `automation_delay_days`, `last_automation_at`, `archived_at`; unique live template per stage), `patient_offers` (snapshot, status, source, `communication_id`, `sent_by`, `viewed_at`, `claimed_at`, `expires_at`; once-per-stage automation index), `communications.body_html`. Staff manage both; patients read and update (claim) their own offers; `clinic_isolation` restrictive on both. Seeds `offers.manage = false` for manager, front desk and practitioner. |
| `src/integrations/supabase/types.ts` | Hand-maintained types for both tables and the new column. |
| `src/lib/auth/clinic-scope.server.ts` | Both tables in `CLINIC_SCOPED_TABLES` (52 tables, 43 scoped). |
| `src/lib/permissions.ts` | `offers.manage` — label "Design and automate offers", new **Marketing** group. Shows in the Team matrix automatically. |
| `src/lib/offers/stages.ts` | Pure: `stageOf`, `planNearingEnd`, `delayElapsed`, `STAGE_META` (labels, meaning, default delays), `renderOffer` (subject, text, HTML with the claim button, portal card fields), `offerClaimUrl`, `offerExpiry`, `STAGE_DEFAULT_DRAFT` (also the AI fallback). |
| `src/lib/offers/cohorts.ts` | Pure: `buildStageCohorts` over patients / appointments / treatments / plans / milestones, `previewStage` (will send vs skipped: no consent, already offered, no email, waiting for delay), `stageCounts`. Same shape as `buildInsights`: production and demo gather rows, this decides. |
| `src/lib/offers/send.ts` | `sendOfferToPatients(store, template, ids, opts)` — one code path for every send surface and the automation; production and demo differ only in the `OfferStore` they pass. `describeOfferChannels` for the dialog's up-front PECR line. |
| `src/lib/offers/shape.ts` | Read-side views: `patientOfferView` (effective status; a sent/viewed offer past `expires_at` reads as expired), `liveClaimedOffer`, labels. |
| `src/lib/demo/data.ts` | Four stage templates (Pre- and Post-consultation on), one one-off "Autumn skin reset"; `patient_offers` in every status (Olivia: one claimed, one open); marketing consent on Isla Hartley, Freya Nielsen and Bea Moreau so every stage has someone to send to; `offers.manage` rows. |
| `tests/unit/offers-stages.test.ts`, `tests/unit/offers-send.test.ts`, `tests/unit/permissions.test.ts` | 23 tests over the rules, rendering, cohorts, the send path (email + link, portal-only vs skipped, archived) and the logged-out redirect. |

## Phase A — server

| Function | Access | Notes |
|---|---|---|
| `listOfferTemplates` | staff | Live templates with per-status send counts. |
| `saveOfferTemplate`, `archiveOfferTemplate`, `setOfferAutomation` | `offers.manage` | One live template per stage; archiving switches automation off; one-offs cannot run automatically. |
| `draftOfferTemplate` | `offers.manage` | `src/lib/offers/draft.server.ts`: Cohere v2 chat with JSON response format; without a key or on any failure returns the stage default with the brief as the offer line. |
| `previewOfferStage` | `offers.manage` | Will send / skipped with reasons, stage counts, effective delay. |
| `listOfferSends` | `offers.manage` | Send history per template. |
| `sendOffer` | `comms.send` | `{template_id, patient_ids[], message?, source, app_origin?}` → `patient_offers` row per patient, marketing email (`templateKey: "offer"`, text + HTML, button to `/portal?next=/my-record?offer=<id>`), optional SMS; portal-only when the patient lacks email consent; returns sent/skipped with reasons. |
| `listPatientOffers` | staff | For the record's Contact tab. |
| `markOfferViewed`, `claimOffer` | `patientSelf` | Claim stamps `claimed_at` and raises `staff_notifications` kind `offer_claimed` to owner, managers and front desk. |
| `runOfferAutomation` | — | `src/lib/offers/automation.server.ts`, called from `drainDueCommunications`. |
| `getPortalHome` | self | Now returns `patientOffers` (live first, then claimed). |
| `getDashboard` | staff | Today's rows carry `claimedOffer` for the diary chip. |

`enqueueCommunication` accepts `bodyHtml`; the drain selects `body_html` and `sendEmail` passes `html` alongside `text` (Resend accepts both; sandbox logs whether HTML was present). The unsubscribe footer is appended to the HTML body as well.

## Phase B — Design Your Offer Template

- `/offers` (`src/routes/_authenticated/offers.tsx`), gated by `offers.manage` (bounces to the dashboard); **Offer templates** in the account menu beside Team and Settings.
- Four stage cards: meaning, on/off switch, "N in stage / M would receive it today", delay and last run, the template with sent/claimed counts, Edit / Who received it / Archive. Stages without a template offer **Design this offer**.
- `OfferTemplateEditor` (sheet): **Draft with AI** (brief + Warm/Playful/Clinical) fills the fields; live preview toggles between the email (sandboxed iframe of the real HTML) and the portal card; delivery switches for email / SMS / portal card.
- `OfferAutomationDialog`: cohort preview with the skipped list and reasons, delay in days, Switch on / Save delay / Switch off. `OfferSendHistoryDialog`: who received it, newest first, linking to each record's Contact tab.

## Phase C — send surfaces

- Patient record: **Send offer** beside Send form (`comms.send`) → `SendOfferDialog` with template picker, optional personal line, the PECR position up front ("Olivia has not opted in to marketing email. This offer can only go to Olivia's portal home.") and the portal card preview; the Contact tab gains an **Offers** card (status, source, dates, code) with its own Send offer.
- Patient table: checkbox per row and select-all for the current view; a **Send offer · N** button appears in the toolbar; the result lists who was sent (email + portal / portal only) and who was skipped and why. Selection clears on view change and after a send.
- Insights: the two "Needs a next step" lists carry **Send offer** per row and a multi-select bulk send; the subtitles say which stage template each list maps to; leads without a patient record are marked as needing one first.

## Phase D — patient portal and staff visibility

- `loggedOutDestination` in `route.tsx`: a signed-out hit on `/my-record*` goes to `/portal?next=<full path>` so the email button lands on the offer after sign-in; staff paths still go to `/auth`.
- `/my-record?offer=<id>` scrolls the card into view, flashes it and marks it viewed.
- Special offers card: the patient's own offers first (New / Offer for you / Claimed, value, code, expiry), **Claim** → `claimOffer` → **Book with this offer** opens the dock chat with a draft quoting the code; the clinic broadcast stays as the fallback. Resources lists every offer with claimed ones marked.
- Bell: `offer_claimed` routes to the record's Contact tab. Diary card: **Offer claimed** chip with the code on hover when the patient has a live claimed offer.

## Phase E — verification

- `check:policy` 160 handlers, `check:validators` 114, `check:tenancy` 52 tables: all green.
- Unit: 14 files, 125 tests green.
- `e2e/offers.spec.ts` (9 tests): permission gating through the Team matrix; stage cards; Draft with AI fallback and save; automation preview → switch on → Process queue → stage card counts, the patient's Offers row and the sandbox email; record send with the PECR note and a portal-only result; bulk send from the table; Insights send; portal deep link → viewed → claim → Resources; front desk bell → Contact tab; diary chip.
- Full Playwright: 130 passed; `reminders.spec.ts` fails identically at the branch point (pre-existing, unrelated).
- tsc: no delta against the branch-point baseline. No linter errors.

## Assumptions carried from the plan

- Automation targets patient records only; a website lead with no record has no consent record, so it is listed as needing one.
- Once per patient per stage for automation; one-off sends are unlimited and the record shows the history.
- A claim records the intent and shows the code to staff and patient; front desk applies it when booking. Expiry is `valid_days` from send.
- SMS is per template and off by default. Cohere drafts are suggestions the user edits; nothing is sent by the AI.
