# Aetheria — Patient Portal Technical Specification

**Version:** 0.1 — DRAFT, NOT FROZEN
**Date:** 12 September 2026
**Repo:** `legitzaisam/patientsys` @ `fcc46e0` (Phase 8 provider adapters)
**Status:** Awaiting merge of the client's brainstormed patient flow, then decision sign-off on §14 before freeze.

> **Design has not started and must not start against this draft.** This document is the input to design, not a design. Section 14 lists 18 open decisions that change the screen inventory. Freeze §5–§12 first.

---

## 1. Purpose and scope

### 1.1 What this document is

A complete functional and technical specification for the Aetheria **patient-facing portal** — every screen, flow, state, server function, table change and authorization rule — sufficient for a designer to produce screens and an engineer to implement without further discovery.

### 1.2 What is in scope

The authenticated patient experience: account activation through to post-treatment aftercare and rebooking. Plus the unauthenticated edges that feed it (invitation links, password reset, public unsubscribe).

### 1.3 What is out of scope

- The clinic/staff portal, except where a patient action creates staff work (a booking request lands in someone's queue).
- The marketing site beyond the `/portal` entry point.
- Native mobile apps. This is a responsive web portal.
- Payment processor selection and PCI scope (§14, D-11).

### 1.4 Terminology

The codebase and the clinic-facing UI say **patient**, not client. Aesthetic clinics use both; Aetheria's README, enums (`message_author: patient`), tables (`patients`) and copy are consistent on "patient" and this spec keeps that. If the product decision changes, it is a global rename, not a portal decision.

---

## 2. As-built baseline

Everything in this section was read from the repository. It is the ground truth the portal is being built onto.

### 2.1 Stack

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Routing / SSR | TanStack Start + TanStack Router, file-based routes |
| Data | TanStack Query + TanStack Start server functions |
| Auth & DB | Supabase — Postgres, Auth, Storage, RLS |
| Realtime | Supabase `postgres_changes` channels |
| Build | Vite 8, Bun lockfile, Node 22+ |
| Hosting | Nitro / Cloudflare via Lovable |

### 2.2 Request path and the RLS caveat

This matters more than anything else in the spec.

```
Browser
  → server function call + bearer token
  → requireSupabaseAuth  (src/lib/auth/session-middleware.server.ts)
      · verifies the user JWT via Supabase Auth
      · builds a SERVICE-ROLE Postgres client — RLS is bypassed
      · wraps it in clinicScoped(client, clinicId)  → every .from() is
        filtered by clinic_id and every insert is stamped with it
  → handler
      → authorize(ctx, handlerName, { patientId })   (src/lib/auth/guards.server.ts)
          · looks the handler up in POLICY (src/lib/auth/policy.ts)
          · applies one of: self | staff | manager | owner | capability
            | patientSelf | staffOrOwnPatient
          · enforces AAL2 for MFA-required identities
  → Postgres
```

The project's access tokens are ES256, which PostgREST rejects, so the app runs on a service-role client. **The 23 restrictive isolation policies and all other RLS are defence-in-depth, not enforcement.** Application-layer authorization is the only real control on the request path. Database *triggers* still fire for the service-role client, which is why signed-document immutability and the patient-delete guard are implemented as triggers rather than policies.

**Consequence for this spec:** every new patient-facing handler must have a `POLICY` entry. A handler missing from the table fails the `check:policy` startup assertion. There is no "it'll be caught by RLS" fallback.

### 2.3 Current routes

| Path | Auth | Who |
|---|---|---|
| `/` | public | Landing; links to both `/auth` and `/portal` |
| `/auth` | public | Staff sign in / sign up |
| `/auth/callback` | public | OAuth return |
| `/auth/reset` | public | Password reset completion |
| `/portal` | public | **Patient sign in** |
| `/_authenticated/*` | session | `ssr: false` shell, identity gate |
| `/dashboard`, `/schedule`, `/patients`, `/patients/:id`, `/team`, `/team/:id`, `/retention`, `/performance`, `/earnings`, `/settings`, `/profile` | staff | Clinic UI |
| `/my-record` | patient | **The entire patient portal, one page** |
| `/api/comms/drain`, `/api/comms/webhooks/{resend,twilio}` | secret / HMAC | Comms transport |

### 2.4 Identity and role model

Roles live in `user_roles`. `app_role` enum: `owner | manager | practitioner | front_desk | patient`.

`readIdentity()` derives:

- `isStaff` — holds owner, manager, practitioner or front_desk
- `isPatient` — `!isStaff`
- `patient` — the `patients` row where `user_id = auth.uid()` (unique since `20260826001000`)
- `clinicId` — from the staff profile, else from the linked patient record
- `mfaRequired` — **owner or manager only**
- `permissions` — capability keys; owners hold all, patients hold none

`destinationFor()` in `src/lib/auth/surfaces.ts` routes staff to `/dashboard` and patients to `/my-record`, and throws `"No patient record is linked to this account"` when neither applies.

### 2.5 What a patient can do today

Everything below lives on the single `/my-record` page.

| Capability | Server function | Notes |
|---|---|---|
| See treatment history | `getMyRecord` | Name, area, performed date, next-due date |
| See documents and sign them | `getMyRecord`, `signDocument` | Signature is a typed full name |
| Submit a health-information update | `submitHistoryUpdate` | Writes a new `medical_history_versions` row, `source = 'patient'` |
| Message the clinic | `sendMessage`, `markMessagesRead` | Realtime channel on `messages` filtered by `patient_id` |
| Set contact preferences | `saveCommsPreferences` | Reminders, marketing, email, SMS |
| See the comms log | `listCommunications` | Read-only; no Process-queue button for patients |
| Change own password | `changeOwnPassword` | |

### 2.6 Data model, relevant tables

`patients` — `id, clinic_id, user_id (unique), title, first_name, last_name, date_of_birth, email, phone, reference, status, allergies, conditions, medications, notes, avatar_url, last_visit_at, email_opt_in, sms_opt_in, reminders_opt_in, marketing_opt_in, unsubscribed_at, deleted_at, deleted_by, deletion_reason, legal_hold, created_at, updated_at`

`appointments` — `id, clinic_id, patient_id, practitioner_id, catalogue_id, treatment_name, treatment_number, starts_at, ends_at, price, payment_status, status, stage, consent_document_id, notes, created_by, created_at, updated_at`

`treatments` — `id, clinic_id, patient_id, practitioner_id, catalogue_id, name, area, product, dose, price, performed_at, next_due_at, status, notes, consent_document_id, commission_rate_snapshot`

`documents` — `id, clinic_id, patient_id, treatment_id, kind, title, body, fields (Json), responses (Json), status, access_token, sent_at, viewed_at, signed_at, signed_name, signed_ip, signature_data, expires_at, created_by`

`treatment_photos` — `id, clinic_id, patient_id, treatment_id, kind (before|after), storage_path, caption, taken_at, visible_to_patient, marketing_consent`

`messages` — `id, clinic_id, patient_id, author (staff|patient), author_id, body, attachments (Json), read_at, created_at`

`medical_history_versions` — `id, clinic_id, patient_id, data (Json), summary, source (staff|patient), changed_by, reviewed_by, reviewed_at, created_at`

`communications` — `id, clinic_id, patient_id, channel, purpose, status, template_key, subject, body, to_address, scheduled_for, sent_at, attempts, provider, provider_message_id, error, related_entity, related_id`

`treatment_catalogue` — `id, clinic_id, name, category, description, price, duration_minutes, interval_days, **requires_consent**, **cooling_off_hours**, active`

`recall_tasks`, `retention_outreach`, `appointment_notes`, `audit_log`, `auth_login_events`, `auth_step_up`, `clinics`, `message_templates`, `role_permissions`, `profiles`, `user_roles`, plus staff-only chat/documents/notifications tables.

### 2.7 Enums

```
appointment_status    booked | attended | cancelled | no_show
visit_stage           booked | arrived | waiting | in_treatment | aftercare | complete | no_show
payment_status        unpaid | deposit_paid | paid | refunded
document_kind         consent | treatment_plan | consultation | aftercare | other
document_status       draft | sent | viewed | signed | expired
photo_kind            before | after
message_author        staff | patient
communication_channel email | sms
communication_purpose transactional | reminder | marketing
communication_status  queued | sending | sent | failed | bounced
patient_status        active | inactive | archived
recall_task_status    open | contacted | completed
```

### 2.8 Comms pipeline (Phases 7–8, built, not yet wired to clinical events)

`enqueueCommunication` writes a `communications` row. `POST /api/comms/drain` with a bearer secret, or the staff `drainCommunications` handler, claims due rows and hands them to `src/lib/comms/email.server.ts` (Resend) or `sms.server.ts` (Twilio). Failures back off `min(15 · 2^(attempts-1), 3600)`s; 8 attempts then `failed`. Webhooks at `/api/comms/webhooks/{resend,twilio}` map delivery events back onto the row. Sandbox mode logs destination and subject only, never the body.

**Nothing clinical calls `enqueueCommunication` yet.** `sendDocument` writes a portal message, not an email. `send-recall-dialog.tsx` still uses `mailto:` and `sms:`. Phase 9 owns that wiring, and this portal spec depends on it.

---

## 3. Gaps in the current portal

Each of these is evidenced in the repository. They are the reason the portal is being rebuilt rather than extended.

### 3.1 Blocking functional gaps

**G-01 — Patients cannot see their appointments.** `getMyRecord` returns `patient, treatments, documents, messages, history, photos`. There is no appointments query, in either the live or the demo implementation. A patient has no way to see when their next visit is. For a booking-driven business this is the single largest hole.

**G-02 — Patients cannot book, reschedule or cancel.** `saveAppointment` and `rescheduleAppointment` are gated `{ kind: "capability", key: "appointments.edit" }`. There is no patient-side path at all. Self-scheduling is the highest-adoption feature of every comparable portal.

**G-03 — The payment deep link is dead.** `src/lib/payment-link.ts` builds `/portal?next=/my-record?pay=<appointmentId>&kind=<deposit|full|balance>`, and staff send it from `today-snapshot.tsx:968` and `schedule.tsx:1071`. `my-record.tsx` has **no `validateSearch`, no `pay` handling and no payment UI**. Every payment link a clinician sends today lands on a page that silently ignores it.

**G-04 — Photos are fetched and thrown away.** `getMyRecord` queries `treatment_photos` where `visible_to_patient = true` and mints 3600s signed URLs. `my-record.tsx` never renders `data.photos`. Before/after imagery is the emotional core of aesthetic care and it is invisible.

**G-05 — Structured forms are modelled but unimplemented.** `documents.fields` and `documents.responses` are `Json` columns. The portal renders only `body` as plain text and collects only a typed name. No intake questionnaire, no medical-history form, no per-question responses.

**G-06 — Document lifecycle states are unreachable.** `document_status` includes `viewed` and `expired`. Nothing sets `viewed_at`; nothing acts on `expires_at`. `signDocument` does not set `signed_ip` despite the column existing. A signed consent therefore lacks the metadata that makes it defensible.

**G-07 — No cooling-off enforcement.** `treatment_catalogue.cooling_off_hours` and `requires_consent` exist and are set per treatment. Nothing reads them. UK guidance (GMC, JCCP/CPSA) expects a reflection period proportionate to risk between the consent discussion and the procedure, and the incoming England licensing scheme proposes a mandatory 48-hour period for non-surgical cosmetic procedures. The data is there; the rule is not.

**G-08 — Consent is one-stage.** A typed name against a block of body text. UK guidance requires a two-stage process: a documented clinical discussion, then a documented record of it. A signature with no recorded discussion is not valid consent.

### 3.2 Structural and UX gaps

**G-09 — The portal is one page.** Forms, health update, contact preferences, comms log, treatments and a chat panel all stack on `/my-record`. No IA, no deep links, no per-section navigation. Patient sidebar has exactly one item.

**G-10 — Mobile is unusable.** Audit §8.4: at 390×844 the sidebar takes ~285px of 390px and the layout *clips* rather than scrolls, so overflowing content is unreachable — no pan, no scroll, no drawer. `src/components/ui/sidebar.tsx` already implements a mobile `Sheet` at lines 189–210 and `use-mobile.tsx` defines a 768px breakpoint; `app-shell.tsx` imports neither.

**G-11 — Dead-end for unlinked accounts.** A patient whose Auth user is not linked to a `patients` row sees "No record linked yet" with no explanation, no contact route and no pending state. Audit §8.3.

**G-12 — No idle timeout for patients.** `<IdleWatchdog enabled={Boolean(identity.isStaff)} />` in `_authenticated/route.tsx`. A patient session on a shared device never times out.

**G-13 — No MFA available to patients.** `mfaRequired = isOwner || roles.includes("manager")`. Patients cannot opt in even if they want to.

**G-14 — Health update is a snapshot with no diff.** The form pre-fills `medications`, `allergies`, `conditions` but leaves `diet`, `pregnancy`, `other` blank on every render, submits all six fields regardless of what changed, then calls `form.reset()`. The patient gets a toast and no record of what they sent. Each submission creates a full new `medical_history_versions` row.

**G-15 — No unsaved-changes protection.** No `beforeunload` handler anywhere. Audit §8.8.

**G-16 — No skip link on any page.** Audit §9.2.

**G-17 — `markMessagesRead` fires on a fragile dependency.** The effect keys on `data?.messages.length`, so a change in read state that does not change the count will not re-run it.

### 3.3 Latent security surface

**G-18 — `documents.access_token` is generated and unused.** The migration enables `pgcrypto` specifically for `gen_random_bytes` on this column. No application code reads it. It is an unauthenticated document-access surface that was designed and then not wired. Either implement it deliberately with expiry and single-use semantics, or drop the column.

**G-19 — `patient-photos` storage policies are staff-only.** All four policies gate on `public.is_staff(auth.uid())`. Server-minted signed URLs work because the service-role client bypasses storage RLS, but any future client-side patient upload will fail. If patients are to upload photos (§14, D-07) this must be fixed first.

---

## 4. Design principles

These are constraints on the design work, not aspirations.

1. **One question per screen on mobile.** Intake and consent are completed on phones, often in a waiting room. Long multi-field forms clip and get abandoned.
2. **Never show a clinical value without context.** A `next_due_at` date is meaningless without "your filler is due for review". Portals that surface raw clinical data generate support calls rather than reducing them.
3. **The home screen answers three questions:** what do I need to do, when am I next in, and what happened last time. Everything else is a click away.
4. **Every state is designed, including empty, loading, error, and denied.** The current retention page renders fabricated zeros instead of an access denial (audit §8.5); the portal must not repeat that pattern.
5. **Actions that create clinical obligations are explicit.** A booking *request* is not a booking. A health update is not reviewed until a clinician reviews it. The copy must never imply otherwise.
6. **Accessibility is WCAG 2.2 AA from the first wireframe.** Not a retrofit. Target ≥44×44px touch targets, visible focus, live regions on async state.
7. **Assume the patient is anxious.** Calm surfaces, no red unless something is genuinely wrong, no countdown pressure on clinical decisions.

---

## 5. Information architecture

### 5.1 Route map

Patient routes live under a new `_patient` layout, sibling to `_authenticated`, so the patient shell is not the staff shell with items hidden.

```
/portal                          Sign in (existing, extended)
/portal/activate                 Invitation acceptance  [NEW, public + token]
/portal/reset                    Password reset completion (reuse /auth/reset pattern)
/portal/unsubscribe              Public one-click unsubscribe  [NEW, public + token]

/_patient/                       Patient shell (own nav, own idle policy)
  /home                          Dashboard                       [NEW]
  /appointments                  List: upcoming + past           [NEW]
  /appointments/:id              Detail, reschedule, cancel      [NEW]
  /book                          Booking request wizard          [NEW]
  /forms                         Outstanding + completed forms   [NEW]
  /forms/:id                     Form / consent completion       [NEW]
  /treatments                    Treatment history               [NEW]
  /treatments/:id                Treatment detail + photos       [NEW]
  /photos                        Before & after gallery          [NEW]
  /messages                      Secure messaging thread         [NEW]
  /payments                      Balances, deposits, receipts    [NEW]
  /health                        Medical history & allergies     [NEW]
  /profile                       Contact details, preferences    [NEW]
  /profile/security              Password, MFA, sessions         [NEW]
  /profile/data                  Download record, SAR, erasure   [NEW]

/my-record                       → 301 to /home (keep; live links exist)
```

`/my-record?pay=X&kind=Y` must redirect to `/payments?appointment=X&kind=Y`, preserving the params, because links already in patients' inboxes point at it (G-03).

### 5.2 Navigation

**Mobile (< 768px):** bottom tab bar, five items — Home, Appointments, Forms (badge), Messages (badge), More. "More" opens a sheet with Treatments, Photos, Payments, Health, Profile.

**Desktop (≥ 768px):** left sidebar in two groups.
- *Your care* — Home, Appointments, Forms, Treatments, Photos
- *Admin* — Messages, Payments, Health, Profile

Badges: Forms shows count of `documents` in `sent`/`viewed` status; Messages shows unread staff messages.

### 5.3 Breadcrumbs

`breadcrumb.tsx` exists and is unused. Detail routes (`/appointments/:id`, `/forms/:id`, `/treatments/:id`) get breadcrumbs. Top-level routes do not.

---

## 6. Flow specifications

Each flow is written as: trigger → preconditions → steps → states → failure modes → data effects.

### F-01 Invitation and activation

**Trigger.** Staff creates a patient record with an email address, then clicks "Invite to portal".

**Precondition.** `patients.email` present and valid; `patients.user_id` is null.

**Steps.**
1. Server generates a single-use activation token: 32 bytes from `gen_random_bytes`, stored hashed (SHA-256) in a new `patient_invitations` table with a 7-day expiry.
2. `enqueueCommunication` queues a `transactional` email, template `patient_invite`, containing `/portal/activate?token=<raw>`.
3. Patient opens the link. Server validates the token: exists, unused, unexpired, patient not already linked.
4. **Identity check.** Patient confirms date of birth. This is the record-matching step every comparable portal uses; it prevents a forwarded or mis-addressed invitation linking the wrong person. Three failed attempts invalidate the token and raise a staff notification.
5. Patient sets a password (min 12 chars, checked against a breached-password list) and accepts the portal terms and privacy notice. Acceptance is recorded with version and timestamp.
6. Server creates the Supabase Auth user, sets `patients.user_id`, inserts `user_roles(patient)`, marks the invitation used, writes an `audit_log` row.
7. Optional MFA enrolment offer (skippable, re-offered later).
8. Redirect to `/home` with a first-run tour.

**Failure modes.**

| Condition | Behaviour |
|---|---|
| Token expired | "This invitation has expired." Offer "Request a new one" → notifies clinic. Never reveal whether the email exists. |
| Token already used | Redirect to `/portal` with "This invitation has already been used. Sign in instead." |
| DOB mismatch ×3 | Invalidate token, staff notification, generic message to patient. |
| Email already has an Auth user | Link the existing user to the patient record after DOB check — do not create a duplicate. `patients.user_id` is UNIQUE; a second link attempt must fail cleanly, not 500. |

**Why not self-signup.** `/auth` currently allows open signup and produces a dead-end account (G-11). The portal is **invite-only**. `/portal` shows no signup form; it shows "Your clinic creates your account" with a contact route.

### F-02 Sign in and session

**Steps.** Email + password → `assertLoginAllowed(email, "patient")` throttle check → `signInWithPassword` → `getMe` → `destinationFor("patient", identity)` → `recordLoginEvent`.

Existing behaviour to preserve: `safeNextPath()` rejects protocol-relative and absolute URLs, blocking open redirects. Extend its allowlist to the new patient routes.

**Extensions.**
- Optional TOTP MFA for patients (G-13). Not required; offered at activation and in `/profile/security`.
- Idle timeout for patients (G-12): 30 minutes, warning at 28, with a "stay signed in" action. Shorter than staff because patients use shared and public devices.
- "Remember this device" suppresses MFA for 30 days, device-bound.
- Failed-login throttle already exists via `auth_login_events` and `check_login_throttle`.

**Wrong-surface handling.** A staff member who signs in at `/portal` is routed to `/dashboard` — existing behaviour in `destinationFor`, keep it. A patient at `/auth` gets `wrongSurfaceMessage("staff")`.

### F-03 Home

**Purpose.** Answer: what must I do, when am I next in, what happened last time.

**Regions, in priority order.**

1. **Action required.** Only rendered when non-empty. Cards for: unsigned consent blocking an upcoming appointment (highest priority), other outstanding forms, unpaid deposit with a deadline, unanswered clinician question, expiring pre-treatment instructions.
2. **Next appointment.** Date, time, treatment, practitioner, location, arrive-by time, payment status, and the cooling-off state if consent is pending. Actions: view, reschedule, cancel, add to calendar (`.ics`).
3. **Your last visit.** Treatment name, date, practitioner, aftercare document link, "how are you healing?" prompt if within the follow-up window.
4. **Due for review.** Derived from `treatments.next_due_at` and `treatment_catalogue.interval_days`. Copy is a suggestion, never a booking obligation.
5. **Recent messages.** Latest two, link to `/messages`.

**Empty state.** A newly activated patient with no history sees a welcome card, "complete your health profile" as the primary action, and "request an appointment" as secondary.

### F-04 Appointments

**List.** Two segments, Upcoming and Past. Upcoming sorted ascending, past descending, paginated at 20. Each row: date, time, treatment, practitioner, status chip, payment chip.

**Detail (`/appointments/:id`).** Full detail plus a **visit timeline** derived from `visit_stage`. Patients see a simplified version — `booked → confirmed → complete` — because `arrived`, `waiting`, `in_treatment` and `aftercare` are operational states that would show a patient they are being tracked in the waiting room. (§14, D-04.)

Also on detail: linked consent document and its status, pre-care instructions, deposit/balance and pay action, cancellation policy with the specific deadline for this appointment, practitioner card, map and travel link.

**Reschedule.** Patient picks from available slots (same rules as F-05 booking). Subject to a clinic-configured notice period. Inside the notice period the button becomes "Request a change" and routes to messaging instead. Rescheduling **must** re-run the cooling-off check: if the new time falls inside `cooling_off_hours` of the consent signature, the reschedule is blocked with an explanation.

**Cancel.** Requires an explicit confirm with the fee consequence stated in plain terms ("Cancelling now means your £50 deposit is non-refundable"). Optional reason from a short list plus free text. Sets `appointments.status = 'cancelled'`, writes an audit row, notifies the practitioner, and releases the slot. A cancelled appointment is never deleted.

**Constraint from the existing schema.** `assertNoPractitionerOverlap` and the `practitioner_no_overlap` exclusion constraint (`20260821001500`) already prevent double-booking at the database level. Patient-initiated writes go through the same path and inherit that protection. Do not add a second overlap check.

### F-05 Booking request

**The core decision (§14, D-01):** does a patient *book* or *request*? This spec assumes **request** for new patients and first-time treatments, and **direct book** for repeat patients booking a treatment they have had before with valid consent on file. Rationale: an aesthetic clinic cannot let an unknown person self-book a prescription-only injectable, but making a returning patient wait for confirmation on their fourth identical appointment is friction with no safety benefit.

**Wizard steps.**

1. **Treatment** — from `treatment_catalogue` where `active = true` and a new `patient_bookable` flag. Shows name, description, duration, price. Category-grouped.
2. **Practitioner** — "any available" or a named practitioner. Patients who have been treated before default to their usual practitioner.
3. **Date and time** — a slot grid from a new `getAvailableSlots` handler. Availability is computed from practitioner working hours (new table, §14 D-02), existing appointments, `duration_minutes` and clinic buffer time.
4. **Screening** — treatment-specific gating questions (pregnancy, anticoagulants, recent treatments, active infection). Any hard-stop answer converts the booking to a consultation request and says why.
5. **Consent and cooling-off preview** — if `requires_consent`, the patient is told a consent form will follow and that the earliest treatment date is `signature + cooling_off_hours`. Slots inside that window are disabled with an explanatory tooltip, not hidden.
6. **Deposit** — if the treatment requires one, payment is taken here (§14, D-11) or the slot is held for 30 minutes pending payment.
7. **Confirm** — summary, cancellation policy, explicit confirm.

**Outcome.** Direct book → `appointments` row with `status = 'booked'`, `created_by = <patient user id>`. Request → a new `booking_requests` row with `status = 'pending'`, plus a staff notification. The patient sees "Requested — we'll confirm within X hours", never "Booked".

**Slot-hold concurrency.** Two patients can request the same slot. Hold rows carry a TTL and a unique constraint on `(practitioner_id, starts_at)` for active holds; the loser is told the slot went and is shown adjacent times.

### F-06 Forms, intake and consent

This is the flow with the most regulatory weight and the largest build.

**Form model.** `documents.fields` (Json) becomes a real schema, `documents.responses` (Json) the answers. A field: `{ id, type, label, help, required, options?, validation?, conditional? }`. Types: `short_text, long_text, single_select, multi_select, boolean, date, number, scale, signature, acknowledgement, photo_upload`.

**Kinds and their behaviours.**

| `document_kind` | Behaviour |
|---|---|
| `consultation` | Intake questionnaire. Long, sectioned, autosaved, resumable. |
| `consent` | Two-stage. See below. Immutable once signed (DB trigger already enforces this). |
| `treatment_plan` | Read + acknowledge. No signature required unless the clinic marks it so. |
| `aftercare` | Read-only reference. Permanently available, never expires. |
| `other` | Generic. |

**Two-stage consent (G-08).** Stage 1 is the clinical discussion, recorded by the practitioner in the clinic app — what was discussed, risks covered, alternatives, questions asked, who took consent. Stage 2 is the patient's portal signature, which cannot be presented until stage 1 exists. The portal shows the patient a summary of the recorded discussion above the consent text, so they are confirming a conversation they had rather than signing a wall of boilerplate. A consent document with no stage-1 record cannot be sent — this is a clinic-app validation, listed here because the portal depends on it.

**Cooling-off (G-07).** On signature, compute `earliest_treatment_at = signed_at + (treatment_catalogue.cooling_off_hours || clinic default) hours`. Store it on the document. The clinic diary must refuse to mark a treatment `attended` before that time without a recorded override and reason. The portal shows the patient: "You've signed. Your treatment can go ahead from **Thursday 14 March, 2:30pm**. Take this time to reconsider — you can withdraw at any point."

**Withdrawal.** A patient can withdraw consent at any time before treatment, from the document view. Sets a new `withdrawn_at`, notifies the practitioner, blocks the appointment. Withdrawal is never buried.

**Signature.** Typed name is the current mechanism and is weak. Minimum viable improvement: typed full name **plus** captured `signed_ip`, `signed_at`, user agent, and the document version hash, all currently modelled or trivially addable. Drawn signature is preferable (§14, D-08).

**Lifecycle fixes (G-06).** Set `viewed_at` on first render, which makes `document_status = 'viewed'` reachable and lets staff see that a patient has read but not signed. Honour `expires_at` — an expired consent shows as expired and offers "request a new one".

**Autosave.** Every field change writes to `responses` after a 2s debounce. A part-completed intake survives a dropped connection or a phone call mid-form. This also removes the need for `beforeunload` guards on forms (G-15), though free-text areas elsewhere still need them.

### F-07 Treatments and health record

**List.** Reverse chronological, grouped by year. Each: treatment, area, date, practitioner, next-due chip.

**Detail.** Product and dose **only if the clinic enables it** (§14, D-05 — some clinics consider batch and dose commercially sensitive; others consider it a patient-safety entitlement). Aftercare document, linked photos, practitioner notes **only where explicitly marked patient-visible** — clinical notes are not patient-facing by default, and under DPA 2018 Schedule 3 a clinician may withhold information likely to cause serious harm, so visibility must be a per-note decision, not a blanket setting.

**Health (`/health`).** Replaces the health-update card (G-14). Shows the current state of allergies, medications, conditions, then a per-section "update" action. Each update shows a **diff** before submission: "You're changing Allergies from *Penicillin* to *Penicillin, latex*." Submits only the changed sections. Shows review status per submission — pending vs reviewed by whom and when, from `medical_history_versions.reviewed_by/reviewed_at`.

Copy must be unambiguous: "Your practitioner will review this before your next visit. If this is urgent, call the clinic on <number>." A patient must never assume a portal form update is a clinical alert.

### F-08 Photos

**Gallery (`/photos`).** Only `treatment_photos` where `visible_to_patient = true`. Grouped by treatment and date. Before/after pairs shown side by side with a comparison slider where both exist.

**Sensitivity.** Aesthetic before/after images are intimate. Requirements: no thumbnails on the home screen; a blur-until-tapped default toggleable in settings; no download without a confirm that states the image is unencrypted once saved; signed URLs expire in 3600s (already the case) and are never logged.

**Marketing consent.** `treatment_photos.marketing_consent` is currently staff-set. The portal must let the patient see which of their photos carry marketing consent and **withdraw it per photo**, because consent under UK GDPR must be as easy to withdraw as to give.

**Upload (§14, D-07).** If patients are to upload healing photos, `patient-photos` storage policies must be extended first (G-19) — all four are currently `is_staff` only.

### F-09 Messaging

Largely built. Keep `PatientChatPanel`, the realtime `postgres_changes` subscription and `markMessagesRead`.

**Changes.**
- Move to a full `/messages` route rather than a side panel; keep a compact home widget.
- Fix the read-receipt dependency (G-17) — key the effect on unread ids, not `messages.length`.
- **Expectation-setting banner, non-dismissible:** "Messages are checked during clinic hours and answered within 1 working day. For anything urgent call <number>. In an emergency call 999." Portals that omit this get used for urgent clinical contact.
- Attachments: `messages.attachments` is `Json` and the `message-attachments` bucket exists. Allow patient→clinic images (a reaction, a healing concern) with type and size limits and server-side validation.
- Optional: `message_templates` powers staff quick replies today. Patient-side quick actions ("I need to reschedule", "I have a question about aftercare") pre-fill and route to the right person.

### F-10 Payments

**Scope note.** `payment_status` and `price` exist; there is no ledger, no invoice table, no processor. This flow assumes a processor decision (§14, D-11) and a new `payments` table.

**Screens.** `/payments` shows outstanding balances, upcoming deposits with due dates, and payment history with downloadable receipts. `/payments?appointment=X&kind=Y` is the landing target for the existing deep link (G-03) and must open directly on the correct payment.

**Deposit flow.** Amount, what it's for, refund terms, pay → processor → webhook → `appointments.payment_status` transitions `unpaid → deposit_paid → paid`. `refunded` is staff-initiated only.

**Non-negotiables.** No card data touches Aetheria. Hosted fields or a redirect only. Failed payments never leave an appointment in an ambiguous state — the deposit hold expires and the slot is released with a notification.

### F-11 Aftercare and follow-up

**Post-treatment.** On `appointments.stage = 'complete'`, queue: an immediate aftercare document (permanent, offline-readable), a check-in at +48h ("how are you healing?" with a concern escalation path), a review request at +14d **only if** `marketing_opt_in`, and a rebooking prompt at `next_due_at - 14d`.

**Concern escalation.** "Something doesn't look right" is a first-class action on any recent treatment. It opens a structured report — what, when it started, photo, severity — flagged urgent in the clinic inbox, with an explicit "if you have difficulty breathing, sudden vision changes or severe pain, call 999 now" interrupt. For injectables, vascular occlusion is time-critical; the portal must not be the slow path.

### F-12 Records access and data rights

`/profile/data` provides:
- **Download my record** — PDF and JSON of treatments, documents, photos, messages, history. Generated async, notified when ready, download link expires in 24h.
- **Request my full record (SAR)** — logs a `subject_access_requests` row with the statutory clock. The clinic must be able to redact third-party data and apply the serious-harm exemption before release, so the export is staff-reviewed, not automatic.
- **Correct my details** — routes to a staff review queue.
- **Erasure request** — surfaces the honest answer: `erase_patient()` exists but is blocked by an 8-year retention clock from last treatment (`20260826003000`) and by legal hold. The portal must say so plainly rather than offering a delete button that always fails.
- **Marketing withdrawal** — immediate, no review.

### F-13 Profile and preferences

Contact details (change requests route to staff review — a patient silently changing their own email is an account-takeover vector), communication preferences (reuse `CommsPreferencesCard`, already patient-aware via `as="patient"`), notification channel and quiet hours, accessibility preferences (reduced motion, larger text, photo blur), and language (§14, D-14).

### F-14 Security

`/profile/security`: change password (`changeOwnPassword` exists), MFA enrolment (new for patients), active sessions with revoke (`listMySessions` and `revokeOtherSessions` exist and are `{ kind: "self" }` — reusable as-is), and a login-history view from `auth_login_events`.

---

## 7. Data model changes

### 7.1 New tables

```sql
-- F-01
patient_invitations (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  token_hash text not null, expires_at timestamptz not null,
  used_at timestamptz, attempts int not null default 0,
  created_by uuid, created_at timestamptz not null default now()
)

-- F-05
booking_requests (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  catalogue_id uuid, practitioner_id uuid,
  preferred_starts_at timestamptz not null, alternate_starts_at timestamptz,
  screening_responses jsonb not null default '{}',
  status booking_request_status not null default 'pending',
  decided_by uuid, decided_at timestamptz, decline_reason text,
  appointment_id uuid, created_at timestamptz not null default now()
)

appointment_holds (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  practitioner_id uuid not null, starts_at timestamptz not null,
  ends_at timestamptz not null, expires_at timestamptz not null,
  created_at timestamptz not null default now()
)
-- partial unique index on (practitioner_id, starts_at) where expires_at > now()

practitioner_availability (
  id uuid pk, clinic_id uuid not null, practitioner_id uuid not null,
  weekday smallint not null, starts_time time not null, ends_time time not null,
  effective_from date, effective_to date
)

practitioner_time_off (
  id uuid pk, clinic_id uuid not null, practitioner_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null, reason text
)

-- F-10
payments (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  appointment_id uuid, amount numeric(10,2) not null, currency text not null default 'GBP',
  kind payment_kind not null, status payment_txn_status not null,
  provider text, provider_payment_id text, failure_reason text,
  created_at timestamptz not null default now(), settled_at timestamptz
)

-- F-12
subject_access_requests (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  kind sar_kind not null, status sar_status not null default 'received',
  due_at timestamptz not null, notes text,
  handled_by uuid, handled_at timestamptz, created_at timestamptz not null default now()
)

-- F-06 stage 1
consent_discussions (
  id uuid pk, clinic_id uuid not null, patient_id uuid not null,
  document_id uuid, practitioner_id uuid not null,
  discussed_at timestamptz not null, risks_covered jsonb not null default '[]',
  alternatives_discussed text, patient_questions text, notes text,
  created_at timestamptz not null default now()
)

-- F-13
portal_terms_acceptances (
  id uuid pk, patient_id uuid not null, terms_version text not null,
  privacy_version text not null, accepted_at timestamptz not null, ip inet
)
```

### 7.2 Column additions

```sql
alter table documents
  add column earliest_treatment_at timestamptz,   -- cooling-off
  add column withdrawn_at timestamptz,
  add column withdrawn_reason text,
  add column version_hash text;                   -- what was signed

alter table treatment_catalogue
  add column patient_bookable boolean not null default false,
  add column requires_deposit boolean not null default false,
  add column deposit_amount numeric(10,2),
  add column screening_schema jsonb not null default '[]',
  add column patient_description text;            -- plain-English, distinct from clinical

alter table clinics
  add column default_cooling_off_hours int not null default 48,
  add column cancellation_notice_hours int not null default 24,
  add column reschedule_notice_hours int not null default 24,
  add column booking_mode text not null default 'request',  -- request | direct | hybrid
  add column timezone text not null default 'Europe/London',
  add column emergency_phone text;

alter table treatments
  add column patient_visible_notes text;          -- distinct from clinical notes
```

### 7.3 New enums

```sql
create type booking_request_status as enum ('pending','accepted','declined','withdrawn','expired');
create type payment_kind as enum ('deposit','balance','full','refund');
create type payment_txn_status as enum ('pending','succeeded','failed','refunded');
create type sar_kind as enum ('access','rectification','erasure','portability','objection');
create type sar_status as enum ('received','in_progress','fulfilled','refused','extended');
```

### 7.4 Migration constraints

Every new table is clinic-scoped: `clinic_id NOT NULL`, a `RESTRICTIVE` isolation policy matching the pattern in `20260826004000`, and registration in `scripts/check-tenancy.mjs`. Migrations must be re-runnable (`IF NOT EXISTS`, idempotent policy drops) — §5.6 of the audit is still open and this is the moment not to make it worse.

---

## 8. Server function contracts

New handlers, each requiring a `POLICY` entry or `check:policy` fails at startup.

| Handler | Method | Access rule | Notes |
|---|---|---|---|
| `getPortalHome` | GET | `self` | One aggregated call for F-03. Avoids six round-trips on the highest-traffic screen. |
| `listMyAppointments` | GET | `self` | Paginated, `upcoming \| past`. Closes G-01. |
| `getMyAppointment` | GET | `patientSelf` | Resolve `patient_id` from the appointment first, then authorize. |
| `getAvailableSlots` | GET | `self` | Availability minus bookings, holds and time off. |
| `holdSlot` | POST | `self` | TTL 30 min. |
| `releaseSlot` | POST | `self` | |
| `createBookingRequest` | POST | `self` | Screening answers validated server-side. |
| `bookAppointmentAsPatient` | POST | `self` | Direct-book path only. Must re-check `patient_bookable`, consent validity and cooling-off server-side. |
| `requestReschedule` | POST | `patientSelf` | Enforces notice period and cooling-off. |
| `cancelMyAppointment` | POST | `patientSelf` | Sets `cancelled`; never deletes. |
| `listMyForms` | GET | `self` | |
| `getMyForm` | GET | `patientSelf` | Sets `viewed_at` on first read. Fixes G-06. |
| `saveFormDraft` | POST | `patientSelf` | Debounced autosave into `responses`. |
| `submitForm` | POST | `patientSelf` | |
| `signDocument` | POST | `patientSelf` | **Extend existing** — capture ip, UA, version hash, compute `earliest_treatment_at`. |
| `withdrawConsent` | POST | `patientSelf` | |
| `listMyTreatments` | GET | `self` | |
| `getMyTreatment` | GET | `patientSelf` | |
| `listMyPhotos` | GET | `self` | Signed URLs, 3600s. Closes G-04. |
| `setPhotoMarketingConsent` | POST | `patientSelf` | Withdrawal must be as easy as granting. |
| `listMyPayments` | GET | `self` | |
| `createPaymentIntent` | POST | `patientSelf` | Processor-dependent. |
| `submitHealthUpdate` | POST | `self` | **Replaces** `submitHistoryUpdate`. Partial, diffed. Fixes G-14. |
| `requestProfileChange` | POST | `self` | Staff review queue. |
| `reportConcern` | POST | `patientSelf` | Urgent flag into the clinic inbox. |
| `requestMyDataExport` | POST | `self` | Async job. |
| `createSubjectAccessRequest` | POST | `self` | Starts the statutory clock. |
| `acceptPortalTerms` | POST | `self` | |
| `validateActivationToken` | POST | *public* | Rate-limited, constant-time, no enumeration. |
| `activatePatientAccount` | POST | *public* | Token + DOB. |
| `unsubscribePublic` | POST | *public* | Token-based, no login. |

**On the three public handlers.** They sit outside `requireSupabaseAuth` and therefore outside `POLICY`. They need their own hardening: strict rate limits keyed on IP and token, constant-time token comparison, generic error messages that never confirm whether an email or patient exists, and audit rows for every attempt. Add a `check:public-handlers` assertion so a fourth one cannot be added without review.

**Handlers to reuse unchanged:** `getMe`, `sendMessage`, `markMessagesRead`, `saveCommsPreferences`, `listCommunications`, `changeOwnPassword`, `listMySessions`, `revokeOtherSessions`, `confirmStepUp`.

**Handler to deprecate:** `getMyRecord` — replaced by the granular set. Keep it returning data for one release so `/my-record` continues to work while links age out.

---

## 9. Authorization additions

The seven existing `Access` kinds cover the portal without extension. Most patient handlers are `{ kind: "self" }` (they read and write only the caller's own rows, safe by construction) or `{ kind: "patientSelf" }` (ownership checked against a resource id).

**The trap.** `requirePatientId` throws if a `patientSelf` handler is called without a resource — deliberately, because an ownership rule with nothing to compare passes everyone. For handlers where the patient supplies an *appointment* or *document* id rather than a patient id, the handler must resolve `patient_id` from that row **before** calling `authorize`, exactly as `signDocument` does today:

```ts
const { data: doc } = await ctx.supabase
  .from("documents").select("patient_id").eq("id", data.id).maybeSingle();
if (!doc) throw new Error("Document not found");
await authorize(ctx, "signDocument", { patientId: doc.patient_id });
```

Any deviation reintroduces audit finding §4.4 — the one where any authenticated user could sign any consent by id.

**Capability keys.** No new keys are needed for patients; patients hold none by design. Two new **staff-side** keys are needed for the work the portal generates:

- `bookings.approve` — accept or decline `booking_requests`
- `portal.invite` — send and revoke portal invitations

Both need entries in `PERMISSION_KEYS`, `PERMISSION_META`, `PERMISSION_GROUPS` and the access-control settings grid.

---

## 10. Notifications and comms matrix

Every row is an `enqueueCommunication` call. Channel respects `reminders_opt_in`, `marketing_opt_in`, `email_opt_in`, `sms_opt_in` and `unsubscribed_at`. Transactional messages ignore marketing opt-out but honour a full unsubscribe.

| Event | Channel | Purpose | Timing | Template key |
|---|---|---|---|---|
| Portal invitation | email | transactional | immediate | `patient_invite` |
| Invitation reminder | email | transactional | +3d if unused | `patient_invite_reminder` |
| Booking confirmed | email + sms | transactional | immediate | `booking_confirmed` |
| Booking request received | email | transactional | immediate | `booking_requested` |
| Booking declined | email | transactional | immediate | `booking_declined` |
| Consent form to sign | email + sms | transactional | on send | `consent_to_sign` |
| Consent unsigned, visit near | sms | reminder | −48h | `consent_chase` |
| Intake form outstanding | email | reminder | −72h | `intake_chase` |
| Appointment reminder | sms | reminder | −24h | `appt_reminder_24h` |
| Appointment reminder | sms | reminder | −2h | `appt_reminder_2h` |
| Deposit due | email + sms | transactional | on request, chase −48h | `deposit_due` |
| Payment receipt | email | transactional | on settle | `payment_receipt` |
| Aftercare | email | transactional | on complete | `aftercare` |
| Healing check-in | sms | reminder | +48h | `healing_checkin` |
| Review request | email | **marketing** | +14d | `review_request` |
| Rebooking prompt | email + sms | reminder | `next_due_at` −14d | `rebook_prompt` |
| New clinic message | email | transactional | +15min if unread | `new_message` |
| Password changed | email | transactional | immediate | `password_changed` |
| New device sign-in | email | transactional | immediate | `new_device` |

**Quiet hours.** No SMS 21:00–08:00 local; queue to the next window. `scheduled_for` already supports this.

**Dependency.** All of this needs Phase 9 to wire clinical events to `enqueueCommunication`. Today `sendDocument` writes a portal message and nothing else.

---

## 11. State machines

**Appointment (patient-visible projection).**
```
requested → confirmed → completed
    ↓           ↓
 declined   cancelled | no_show
```
Maps onto `appointment_status` plus `booking_requests.status`. The operational `visit_stage` values are not exposed (§14, D-04).

**Document.**
```
draft → sent → viewed → signed
                 ↓        ↓
              expired  withdrawn
```
`draft` is never patient-visible. `signed → withdrawn` is permitted before treatment; the signed record is retained immutably (DB trigger) and the withdrawal is a separate fact.

**Payment.**
```
pending → succeeded → refunded
    ↓
 failed → (retry) → pending
```

**Booking request.**
```
pending → accepted (creates appointment)
    ↓
 declined | withdrawn | expired
```

---

## 12. Non-functional requirements

**Accessibility — WCAG 2.2 AA.** Skip link on every route (G-16). Visible focus. 4.5:1 text contrast, 3:1 non-text. Touch targets ≥44×44px. Live regions on all async state, not just toasts. Labelled controls (audit §9.3 found gaps). Keyboard-operable everywhere including the photo comparison slider. Toggle state via `aria-pressed` (§9.5). Reduced-motion support.

**Mobile.** Mobile-first, tested at 390×844 as the primary viewport. Drawer navigation via the existing `sidebar.tsx` `Sheet` and `use-mobile.tsx` — both already in the repo and unused by `app-shell.tsx`. **No clipped layouts** (G-10): overflow scrolls or wraps, never clips.

**Performance.** Home LCP < 2.0s on 4G. `getPortalHome` is a single call. Photos lazy-load with blur placeholders. Route-level code splitting; the patient bundle must not pull in the diary or reporting code.

**Offline.** Aftercare documents cached for offline reading — patients look them up at 2am without signal.

**Error handling.** Every query inspects `isError`. Audit §7.3 found zero query error handling outside the identity gate, and §8.5 found the failure mode: a permission error rendered as legitimate zeros. Patient screens must show "we couldn't load this" with a retry, never fabricated empty data.

**Browser support.** Last two versions of Safari (iOS and macOS), Chrome, Edge, Firefox. Safari iOS is the dominant patient browser and gets explicit testing.

**Audit.** Every patient action that touches clinical data writes an `audit_log` row: form views, signatures, withdrawals, booking changes, data exports, marketing-consent changes.

---

## 13. Compliance notes

Engineering interpretation, not legal advice. A DPO or clinical governance lead should review before build.

**Consent (GMC / JCCP / CPSA).** Two-stage — discussion then documentation. A signature without a recorded discussion is not valid consent. Cooling-off proportionate to risk; the proposed England licensing scheme for non-surgical cosmetic procedures contemplates a mandatory 48-hour period and a two-part consent process, with a green/amber/red risk tiering. Building `cooling_off_hours` per treatment now means the clinic can meet whichever number lands.

**UK GDPR.** Health data is special category — Article 9 explicit consent or another Article 9 condition. Withdrawal must be as easy as giving. SAR responses within one month, extendable to three. The DPA 2018 Schedule 3 serious-harm exemption and third-party-data provisions mean portal record access **cannot be a raw dump** — clinical notes need per-item visibility decisions and staff review before release.

**Retention vs erasure.** `20260826003000` sets an 8-year clock from last treatment plus legal hold, and `erase_patient()` is the only door. The portal must tell patients this honestly rather than offering an erasure button that always fails.

**Records.** Children's records to the 25th birthday (26th if treatment ended at 17). If the clinic treats under-18s at all (§14, D-16), that is a separate consent and capacity flow.

**Accessibility.** WCAG 2.1 AA is a legal requirement in several jurisdictions and the practical baseline; this spec targets 2.2 AA.

---

## 14. Open decisions

**Freeze blockers. Design cannot start until these are answered — several change the screen inventory.**

| # | Decision | Options | Impact |
|---|---|---|---|
| D-01 | Booking model | Request-only / direct-book / hybrid by treatment and patient history | Changes F-05 entirely and the staff queue |
| D-02 | Availability source | New `practitioner_availability` table / import from an external calendar / staff-published slots only | Determines whether `getAvailableSlots` is buildable |
| D-03 | Which treatments are patient-bookable | All active / a curated subset / consultation-only for new patients | `patient_bookable` defaults |
| D-04 | Does the patient see `visit_stage`? | Full / simplified 3-state / hidden | Spec assumes simplified |
| D-05 | Product and dose visibility | Always / clinic setting / never | Patient-safety vs commercial sensitivity |
| D-06 | Practitioner notes visibility | Never / per-note opt-in / summary only | Spec assumes per-note opt-in |
| D-07 | Patient photo upload | Yes / no / concern-reports only | Requires storage policy work (G-19) |
| D-08 | Signature method | Typed / drawn / drawn + typed | Evidential strength of consent |
| D-09 | MFA for patients | Off / optional / required | Friction vs PHI protection |
| D-10 | Session timeout | 15 / 30 / 60 min | Spec assumes 30 |
| D-11 | Payment processor | Stripe / Square / GoCardless / none in v1 | Whole of F-10 |
| D-12 | Deposit policy | Per treatment / clinic-wide / none | Booking flow branching |
| D-13 | Cancellation windows and fees | Clinic-configured / fixed | Copy and enforcement |
| D-14 | Languages | English only / multi | Affects every string and the DB if content is translated |
| D-15 | Family or proxy access | Yes / no | Significant auth model change — do not defer silently |
| D-16 | Under-18 patients | Not treated / treated with guardian consent | Separate capacity and consent flow |
| D-17 | Multi-clinic patients | One clinic per login / patient picks | `patients.user_id` is UNIQUE — supporting this is a schema change, not a UI one |
| D-18 | `documents.access_token` | Implement unauthenticated document links / drop the column | Currently a designed-but-unwired surface (G-18) |

---

## 15. Suggested phasing

Sequenced so each phase ships something usable and nothing depends on an unbuilt phase.

| Phase | Contents | Why here |
|---|---|---|
| **P1 Foundation** | `_patient` shell, IA, bottom nav, mobile drawer, `/home`, `getPortalHome`, `listMyAppointments`, redirect `/my-record`, skip links, error states | Closes G-01, G-09, G-10, G-16. Ships the biggest missing thing. |
| **P2 Forms and consent** | Form renderer, `fields`/`responses`, autosave, two-stage consent, cooling-off, `viewed_at`, withdrawal, `/forms` | Closes G-05 to G-08. The highest regulatory weight. |
| **P3 Record** | `/treatments`, `/photos`, `/health` with diffs, `/messages` as a route | Closes G-04, G-14, G-17. |
| **P4 Booking** | Availability, slots, holds, `booking_requests`, reschedule, cancel, staff approval queue | Closes G-02. Depends on D-01 to D-03. |
| **P5 Payments** | `payments`, processor, deposits, receipts, deep-link landing | Closes G-03. Depends on D-11. |
| **P6 Lifecycle** | Comms matrix wired to Phase 9, aftercare, check-ins, rebooking, concern reports | Depends on Phase 9. |
| **P7 Rights and security** | `/profile/data`, exports, SAR queue, patient MFA, idle timeout, login history | Closes G-12, G-13. |

**Cross-cutting prerequisite.** Phase 9 (wiring clinical events to `enqueueCommunication`) is not a portal phase but P1 activation emails depend on it. Either land Phase 9 first or accept that P1 invitations are sent manually.

---

## 16. What this document still needs

1. **The client's brainstormed patient flow.** It was referenced but not received. It must be merged and reconciled against §6 before freeze — where it differs, the client's version is the starting point and any change needs a stated reason.
2. **Answers to §14.** Eighteen decisions, of which D-01, D-02, D-11 and D-15 are structural.
3. **A screen inventory.** Once §14 is settled, enumerate every screen and state so design scope is countable rather than estimated.
4. **Copy deck.** Clinical and legal copy — consent framing, cooling-off explanation, emergency escalation, retention honesty — should be drafted and reviewed before design, not written into mockups.
5. **Clinical governance review** of §6 F-06, F-07 and F-11, and DPO review of §13.
