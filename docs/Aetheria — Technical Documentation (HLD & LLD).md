# Aetheria — Technical Documentation (HLD & LLD)

Page\_DownPage\_DownPage\_DownPage\_DownPage\_DownPage\_DownPage\_DownPage\_DownSep 26, 2026 · @Karn Deb

## 1. Executive summary

Aetheria is a clinical-records and practice-management web app for UK aesthetic clinics and medspas, with two portals on one codebase: a **clinic portal** for staff (owner, manager, practitioner, front desk) and a **patient portal** at `/my-record`. It is a TanStack Start (React 19, SSR) app backed by one Supabase project (Postgres, Auth, Storage, Realtime), with a full fixture-driven **demo mode** that runs the whole product with no backend.

**Current build state (branch `e2e`, HEAD `b2e554e`, pulled 26 Sep 2026):**

| Dimension | Measure |
| --- | --- |
| Source size | \~75,900 lines across `src/` (290 files); `clinic.functions.ts` alone is 8,168 lines |
| Server functions | 161 `createServerFn` handlers in production, 162 in the demo twin; every one registered in the `POLICY` map |
| Database | 52 public tables, 22 enums, 13 callable SQL functions (plus trigger functions), 73 migrations, \~180 RLS policies |
| Routes | 36 route files: 27 authenticated pages, 6 HTTP API routes, and 7 public pages (landing, staff sign-in, reset, OAuth callback, patient sign-in, consent link, unsubscribe link) |
| Capabilities | 56 permission keys (15 capabilities + 41 page/tab/component visibility keys) in 8 groups, 6 roles (`owner`, `manager`, `practitioner`, `front_desk`, `patient`, plus admin: a software-developer superuser) |
| Tests | 16 Vitest files (\~133 unit tests); 19 Playwright specs (130 tests passing at last full run, 1 spec failing) |
| Git | 93 commits, 18 Aug to 25 Sep 2026; `e2e` is 40 commits ahead of `main` |

**What is built and working (demo-verified):** diary with day/week/month planners and a guided visit-stage machine; patient records with treatments, before/after photos, consent and documents, medical history review; a three-page treatment form (arrival to complete); retention, performance, earnings and insights reports; staff chat, alerts and a floating dock with browser voice calls; an email/SMS outbox with Resend/Twilio adapters, PECR preferences and unsubscribe; consent magic links; stage-based offers with pictures and AI drafting; a role access catalogue that shows or hides every page, tab and major component per role (edited by a software-developer admin at /access); and an eleven-page patient portal with plan timeline, journal, routine, records and an AI care assistant.

**What is not yet production-real:** no live email or SMS has ever been sent (sandbox only); the service-role client means RLS is defence-in-depth, not enforcement; Phase 6 (auth hardening), 10 (portal onboarding), 11 (architecture/tests) and 12 (UX/accessibility) are open; `tsc --noEmit` still reports \~50 errors; the new admin account is provisioned with a default password committed in scripts/provision-staff.mjs; one Playwright spec (`reminders.spec.ts`) fails.

### 1.1 Latest update: pull of 26 Sep 2026 (`dc9539d` → `b2e554e`)

Six commits (25 Sep, 22:30–23:39 BST) turn the fixed role model into a **per-role visibility catalogue** with a new `admin` role, and add pictures to offers: 105 files, +2,155 / −273 lines, 3 migrations, no new server functions.

| Commit | Change |
| --- | --- |
| `98ec3d9` | Access catalogue: 41 `view.*` keys, `/access` route, catalogue editor, `admin` role, visibility checks across shell and pages; `docs/rbac/access-catalogue.md` + 50 role screenshots |
| `36a620f` | Clarifies that only the software-developer admin opens `/access`; the owner edits staff capabilities on Team |
| `b17ba12` | Provisioning adds a "Software developer" admin account; demo role switcher gains "Software admin"; admin hidden from team lists |
| `d0cc6d9` | Browser autofill detection on sign-in forms (`login-autofill.tsx`, `autocomplete="username"`); demo persona chosen from sign-in email |
| `e7912a6` | Simplifies shell navigation and role switching for admin; trims the autofill hook from staff sign-in |
| `b2e554e` | Offer pictures (upload, 5 placements) on templates, email and portal card; "Offer templates" menu item renamed "Offers" |

**What changed for each part of the system:**

- **Authorization:** `can()` now returns true for owner **and admin**; `isManager` includes admin. Two new access kinds in `POLICY`: `self` with an optional `view` key, and `accessAdmin` (owner or admin). Handlers re-gated: `getDashboard` → `view.dashboard`, `getPatient` staff side → `view.patients`, `getMyProfile` → `view.profile`, `getMyEarnings` → `view.earnings`, portal plan/timeline/journal/routine reads → `view.portal.plan*`, `listRolePermissions` / `setRolePermission` → `accessAdmin` (now also editable for the `patient` role). `getPractitionerPerformance` dropped its extra `requireManager`, so `reports.performance` alone governs it.
- **UI gating:** `IdentityGate` redirects any page the caller cannot see to their first visible page (staff) or portal page (patients); `/access` bounces everyone except admin. Dashboard cards, patient-list tabs, record tabs and buttons, insights tabs, team tabs, shell search/alerts/dock and the account menu all check `canSee(identity, nodeId)`.
- **Database:** `app_role` gains `admin`; `is_staff()` includes admin; `role_permissions` seeded with default `view.*` rows for manager, practitioner, front desk and patient in every clinic; `offer_templates` and `patient_offers` gain `image_url` + `image_placement`; new public Storage bucket `offer-images`.
- **Tests and docs:** `tests/unit/access-catalogue.test.ts` (5), one new offer-picture test in offers-stages, period-picker labels ("This week", "This month", "Last 6 months"); `docs/rbac/` baseline catalogue per role with a list of nav/page/API mismatches.

## 2. Repository map and tech stack

The repo is a single TanStack Start application (Lovable template `tanstack_start_ts_current`) with the server layer, demo layer, schema and tests side by side; it syncs to Lovable through GitHub, so published history must never be rewritten.

### 2.1 Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node 22.23.2 (`.node-version`), engines `>=22.12` | Node 22 is mandatory: older Node lacks native WebSocket and Supabase Realtime fails at `getMe` (the root screenshots `sh-1.png` / `sh-2.png` show this failure) |
| UI | React 19.2, TypeScript 5.8 (`exactOptionalPropertyTypes` on), Tailwind CSS 4.2 | shadcn-style primitives on Radix UI; `lucide-react` icons; `sonner` toasts; `vaul` drawers; `cmdk` |
| Routing / SSR | TanStack Start 1.168 + TanStack Router 1.170 (file-based) | `_authenticated` subtree is `ssr: false` (client-rendered behind auth) |
| Data fetching | TanStack Query 5 + `createServerFn` RPCs | Every read/write is a server function; the browser never queries tables directly except Realtime subscriptions and Storage uploads |
| Forms / validation | react-hook-form 7 + zod 3 (`@hookform/resolvers`) | One zod schema set shared by client forms and server validators |
| Rich text | Tiptap 3 (starter kit, link, underline, task list, placeholder) | Staff notes and visit notes |
| Charts | Recharts 2.15 | Performance, retention, insights |
| Backend | Supabase JS 2.112 (Postgres, Auth, Storage, Realtime) | Project ref `aljozsxrdqfxiqczhbqn` (`patientsys`, eu-west-1) |
| Comms | Resend (email), Twilio (SMS, browser Voice via `@twilio/voice-sdk`) | Raw `fetch` adapters, no provider SDKs server-side |
| AI | Cohere v2 chat (`command-a-plus-05-2026`) | Care assistant, demo AI patient replies, offer drafting, product-link extraction fallback; all degrade to canned output without a key |
| Build / deploy | Vite 8, Nitro 3 beta, Cloudflare target via `@lovable.dev/vite-tanstack-config` | `.output/` and `.wrangler/` show a Cloudflare Workers build |
| Quality | ESLint 9, Prettier 3, Vitest 5, Playwright 1.63 | CI in `.github/workflows/verify.yml` |

### 2.2 Folder map

| Path | What lives there |
| --- | --- |
| `src/routes/` | File-based routes. `__root.tsx` (shell, fonts, error UI), public pages, `_authenticated/` (staff + patient pages), `api.*.ts` HTTP handlers. `routeTree.gen.ts` is generated |
| `src/lib/clinic.functions.ts` | The production data layer: 161 server functions (8,165 lines) |
| `src/lib/clinic.functions.demo.ts` | Demo twin (5,953 lines) swapped in by a Vite plugin when `DEMO=1` |
| `src/lib/auth/` | `policy.ts` (access map; the page/tab/component visibility catalogue lives beside it in lib/access-catalogue.ts), `guards.server.ts` (authorize, identity), `session-middleware.server.ts` (JWT → scoped client), `clinic-scope.server.ts` (tenant proxy), MFA, throttle, OAuth, surfaces |
| `src/lib/validation/` | `schemas.ts` (\~114 zod schemas), `primitives.ts`, `parse.ts` (`parseInput`) |
| `src/lib/comms/` | Outbox enqueue, dispatch/drain, Resend + Twilio adapters, webhooks, templates, PECR preferences, unsubscribe HMAC, voice token |
| `src/lib/offers/` | Stage rules, cohorts, send path, automation, AI draft, read shapes |
| `src/lib/portal/` | Patient-portal view shaping and product-link extraction |
| `src/lib/demo/` | `data.ts` (4,973-line deterministic fixture clinic), AI patient responder, `enabled.ts` |
| `src/lib/*.server.ts` | Report engines: `retention`, `retention-insights`, `earnings`, `insights`, `insights-ingest`, `visit-stage`, `documents/access` |
| `src/components/` | \~130 feature components grouped by area (`dashboard/`, `retention/`, `performance/`, `insights/`, `offers/`, `portal/`, `floating-dock/`, `notes/`, `comms/`) plus 46 primitives in `ui/` |
| `src/integrations/supabase/` | Generated clients (`client.ts` browser, `client.server.ts` service role), `types.ts` (partly hand-maintained), generated auth middleware (unused in favour of `lib/auth`) |
| `supabase/migrations/` | 73 SQL migrations, 11 Aug to 28 Sep 2026 (the last three carry forward-dated names) |
| `scripts/` | Provisioning, ledger-aware migration runner, DB snapshot, three static checks, three QC capture scripts |
| `tests/unit/` · `e2e/` | Vitest units · Playwright specs (demo mode, port 8091) |
| `docs/` | Audits, WORKLOG, phase micro-plans, clinic-portal guide + screenshots, RBAC access catalogue baseline (docs/rbac, 50 screenshots), patient-portal specs and wireframes v1 to v4, workstream work logs |
| `.cursor/plans/` · `.lovable/plan/` | 28 Cursor agent plans and 11 Lovable plans; the design history of every feature |

### 2.3 Environments and modes

| Mode | Command | Data | Identity |
| --- | --- | --- | --- |
| Live dev | `npm run dev` (port 8080) | Supabase via service role | Supabase Auth session |
| Demo | `npm run dev:demo` (`DEMO=1`) | In-memory fixtures (`demo/data.ts`), mutable per server boot | `demo_role` cookie: owner, practitioner, front\_desk, patient, admin; a role switcher sits bottom-left, and signing in with a known demo email picks the matching persona |
| Test | `npm run test:e2e` | Demo on port 8091, fresh server per run, serial | `demo_role` cookie set by the fixture |
| Production | Lovable publish (Nitro → Cloudflare) | Supabase | Supabase Auth |

Key environment variables (from `.env.example`): Supabase URL/keys duplicated as `VITE_*` for the browser, `SUPABASE_SERVICE_ROLE_KEY` (server only), `DATABASE_URL` (scripts), `COMMS_SANDBOX`, `COMMS_DRAIN_SECRET`, `RESEND_*`, `TWILIO_*` (SMS + Voice), `APP_ORIGIN`, `AUTH_DEV_SHOW_OTP`, `COMMS_UNSUBSCRIBE_SECRET`, `COHERE_API_KEY` / `COHERE_MODEL`.

## 3. High-level design (HLD)

Aetheria is a server-function monolith: both portals are one React SPA that calls \~160 typed RPCs on a TanStack Start server, which verifies the Supabase JWT, wraps a **service-role** Supabase client in a clinic-isolation proxy, and applies a declarative access rule before touching Postgres.

&#91;image: Aetheria system context: clients, TanStack Start server, Supabase and providers\]

Browsers talk to the server only through server functions; the two direct Supabase connections are Realtime subscriptions and Storage uploads/signed-URL reads, which run with the user's JWT and so do hit RLS.

### 3.1 Logical components

| Component | Responsibility | Key files |
| --- | --- | --- |
| Clinic portal | Staff SPA: dashboard, diary, patients, record, reports, team, settings, offers | `routes/_authenticated/*.tsx` (non `my-record`), `components/app-shell.tsx` |
| Patient portal | Patient SPA under `/my-record/*` with its own sidebar, dock (chat + AI) | `routes/_authenticated/my-record*.tsx`, `components/portal/*` |
| Public surfaces | Landing, staff sign-in, patient sign-in, consent magic link, unsubscribe | `routes/index.tsx`, `auth.tsx`, `portal.tsx`, `d.$token.tsx`, `u.$token.tsx` |
| Session layer | Client middleware attaches/refreshes the bearer token; server middleware verifies it and builds `Ctx` | `lib/supabase-session-middleware.ts`, `lib/auth/session-middleware.server.ts` |
| Authorization | `POLICY` map (161 entries), visibility catalogue (canSee, 58 nodes), `authorize()`, guards, scope rules, MFA and step-up | `lib/auth/policy.ts`, `lib/auth/guards.server.ts` |
| Tenancy | Proxy that filters/stamps `clinic_id` on 43 tables | `lib/auth/clinic-scope.server.ts` |
| Domain layer | Server functions + pure engines (retention, earnings, insights, offers, visit stage, portal shaping) | `lib/clinic.functions.ts`, `lib/*.server.ts`, `lib/offers/*` |
| Comms | Outbox, dispatch with retry, provider adapters, webhooks, unsubscribe | `lib/comms/*`, `routes/api.comms.*` |
| Demo layer | Same exports over in-memory fixtures; Vite resolves `clinic.functions.ts` to the demo file | `vite.config.ts`, `lib/clinic.functions.demo.ts`, `lib/demo/*` |
| Data | Postgres schema, RLS, triggers, RPCs; Storage buckets; Realtime publication | `supabase/migrations/*` |

### 3.2 Request lifecycle (server function)

1. **Browser.** A component calls `useServerFn(fn)` inside TanStack Query. The global client middleware `ensureSupabaseSession` waits up to 3 s for a session, refreshes it if it expires within 60 s (one refresh in flight at a time), and adds `Authorization: Bearer <jwt>`.
2. **Request middleware.** `errorMiddleware` renders a branded 500 page for uncaught errors; `createCsrfMiddleware` guards every server-function call against cross-site requests.
3. **`.validator()`.** `parseInput(Schema, data)` runs the zod schema; unknown keys are stripped and a failure becomes one readable sentence for the toast.
4. **`requireSupabaseAuth`.** Verifies the JWT with `auth.getClaims` (tokens are ES256, which PostgREST rejects with "JWT issued at future"), resolves the caller's `clinic_id` from `profiles` or `patients`, and passes `Ctx { supabase: clinicScoped(serviceClient), clinicId, userId, claims, accessToken }`.
5. **`authorize(ctx, name, {patientId?})`.** Looks up `POLICY[name]`, loads identity once per request (4 parallel queries, WeakMap-cached), applies the rule, then enforces the owner/manager email-MFA gate.
6. **Handler.** Queries through the scoped client, writes `audit_log` rows after mutations, may enqueue communications or staff notifications, returns plain JSON.
7. **Browser.** TanStack Query caches under keys like `["dashboard"]`, `["patient", id]`; mutations invalidate them. Realtime events and polling (19 `refetchInterval` sites) refresh live views.

### 3.3 Authentication and identity model

- **Two sign-in surfaces.** `/auth` for staff and `/portal` for patients. `destinationFor(surface, identity)` sends staff to `/dashboard` and patients to `/my-record`, and signs out an account on the wrong surface.
- **Methods.** Email + password, native Supabase OAuth (Google, Microsoft), self-service reset (`/auth/reset`), login throttle (5 failures in 15 min locks for 15 min, per email and surface).
- **Staff gates** in `_authenticated/route.tsx`, in order: session present → `getMe` succeeds → revoked-staff kick-out → forced password change (invites) → email-code MFA for owner/manager (only when Resend is configured; stands down otherwise) → welcome dialog → 15-minute idle watchdog.
- **Step-up.** Destructive actions (archive, revoke) need a password re-confirmed within 5 minutes (`auth_step_up`).
- **Bootstrap.** The very first user with no roles becomes clinic owner in `getMe`; a user linked to a `patients` row gains the `patient` role. A trigger `handle_new_user` creates a `profiles` row for every auth user and links patients by email (oldest row, one only). A sixth role, admin (software developer), signs in on the staff surface, holds every capability and visibility key, counts as a manager, and is hidden from team lists; the account is created by scripts/provision-staff.mjs.

### 3.4 Authorization model

Authorization now has two layers that share one grant table (`role_permissions`) and one evaluator (`can()`):

1. **Capabilities** (15 keys, e.g. `comms.send`, `treatments.record`) govern what a role may **do**. Eight access kinds cover all handlers: `self` (optionally with a `view` key), `staff`, `capability(key)`, `manager`, `owner`, `staffOrOwnPatient(staffKey?)`, `patientSelf`, and `accessAdmin` (owner or admin). The clinic owner edits capabilities in Team → Staff access, which now hides the `view.*` keys.
2. **Visibility** (41 `view.*` keys in the access catalogue, §8.10) governs what a role may **see**: pages, tabs and major components for manager, practitioner, front desk and, for the first time, patients. Only the software-developer `admin` edits these, at `/access`.

Owners and admins hold every key. `npm run check:policy` fails the build when a handler lacks a `POLICY` entry or never calls `authorize`. Data scoping rules sit beside the map: `practitionerOwnBook` (dashboard, retention) and `nonManagerOwnAssignments` (open recall tasks). Most visibility keys are enforced in the UI only; eight are also enforced on the server (`getDashboard`, the staff side of `getPatient`, `getMyProfile`, `getMyEarnings`, and the four portal plan reads).

### 3.5 Tenancy

Every request runs on the service-role client, so RLS does not bind application traffic. Isolation is enforced by the `clinicScoped` proxy, which adds `.eq("clinic_id", id)` to every select/update/delete and stamps inserts on the 43 clinic-scoped tables. RESTRICTIVE `clinic_isolation` policies and `current_clinic_id()` exist in the database as a second line for any traffic that does use the user's JWT (Realtime, Storage). `npm run check:tenancy` fails when a table is unclassified.

### 3.6 Deployment topology

- One Supabase project (eu-west-1) holds Postgres, Auth, four Storage buckets (`patient-photos`, `message-attachments`, `staff-files`, plus the public offer-images bucket) and Realtime on `messages`, `staff_notifications`, `staff_chat_messages`, `staff_conversation_reads`, `role_permissions`, `user_roles`.
- The app builds with Vite + Nitro to a Cloudflare Workers bundle (`.output/server`, `wrangler.json`), published through Lovable from the synced GitHub branch.
- The outbox drain is a secret-protected HTTP route meant to be hit by `pg_cron` + `pg_net`; the schedule is deliberately not in a migration and is not yet configured.
- Providers: Resend (email + delivery webhooks, Svix-signed), Twilio (SMS with SHA1-signed webhooks; Voice via TwiML App), Cohere (AI).

## 4. Patient portal

The patient portal is an eleven-page subtree at `/my-record/*`, ported pixel-faithfully from the V4 wireframes into the live app on 22 Sep 2026 and corrected after client feedback on 24 Sep; every page reads from a purpose-shaped `getPortal*` server function whose only access rule is `self` (the caller's own patient row, never a `patient_id` argument).

### 4.1 Entry, gating and shell

- **Sign-in** at `/portal` (email/password, Google/Microsoft OAuth, reset). `?next=` is honoured, so an offer email link like `/portal?next=/my-record?offer=<id>` lands on the offer after login. Signed-out hits on any `/my-record*` path redirect there via `loggedOutDestination`.
- **Gate.** `IdentityGate` forces any non-staff identity into the `/my-record` subtree. `my-record.tsx` is the layout: staff who type the URL see an explanatory card; a patient account with no linked `patients` row sees "No record linked yet". Since the 26 Sep pull each portal page, plan sub-tab, the dock chat and the avatar-menu items are gated by view.portal.\* keys (all on by default for the patient role); a page switched off redirects to the first page the patient can still see.
- **Shell.** The same `AppShell` as staff, with a patient sidebar: **Care** (Home, Skin Plan & Journey with sub-nav Overview / Timeline / Journal / Skincare Routine, My Clinic, My Profile / Records, Appointments) and **Support** (Resources). Billing, Settings and "My record" sit in the avatar menu. The Messages page was removed in the feedback round; messaging lives in the dock.
- **Portal dock** (`components/portal/portal-dock.tsx`): two butter-gradient bubbles bottom-right, chat (clinic thread via `getPatientMessages` / `sendMessage`, unread badge from `getUnreadMessages`) and AI (care assistant). `openPortalChat(draft?)` opens the chat from anywhere with a pre-filled message (Reply, Reschedule, Message Clinician, Book with this offer).

### 4.2 Page inventory

| Route | Page | What it shows | Server functions | Tables read / written |
| --- | --- | --- | --- | --- |
| `/my-record` | Home | Greeting; KPI strip (current plan, completion ring, next appointment, clinician); Clinic news; Special offers (patient's own offers first, then clinic broadcast); Please confirm your appointment (Confirm / Reschedule) or a booking CTA; Latest message with read state and Reply; Your plan progress track; Quick actions | `getPortalHome`, `confirmAppointment`, `markOfferViewed`, `claimOffer` | patients, treatment\_plans, plan\_milestones, appointments, clinic\_news, clinic\_offers, messages, patient\_offers, profiles |
| `/my-record/plan` | Plan Overview | KPI strip; Today / Next action; Recovery check-in sliders (redness, sensitivity, dryness, persisted on release, with a note); Before & After progress; Journey snapshot; Safe to Proceed? checklist | `getPortalPlan`, `submitRecoveryCheckin`, `toggleChecklistItem` | recovery\_checkins, plan\_milestone\_checklist, treatment\_photos |
| `/my-record/plan/timeline` | Timeline | Month-grouped roadmap; Step details panel with three states (completed: treatment details, consent/consultation pills, photos, visit note; in progress: detail + checklist; upcoming: due and booked dates, checklist, Contact clinic); Pause plan modal with reason, notes and validation | `getPortalTimeline`, `requestPlanPause`, `toggleChecklistItem` | plan\_milestones, plan\_milestone\_checklist, plan\_pause\_requests, treatment\_sessions (visit notes) |
| `/my-record/plan/journal` | Journal | Entries with kind tags (skincare, photos, vitamins, appointment, skin change, voice note), one Tags filter, search, calendar, New entry, Share with clinic | `getPortalJournal`, `createJournalEntry`, `deleteJournalEntry` | journal\_entries, journal\_attachments |
| `/my-record/plan/routine` | Skincare Routine | Morning and evening steps from the clinic, practitioner note, adherence ring, upcoming reminder (Mark as complete / Snooze), skin response, product guide; per-step Edit: paste a product link, server extracts name and how-to, saved as a patient override | `getPortalRoutine`, `markRoutineComplete`, `snoozeRoutineReminder`, `extractProductFromLink`, `saveRoutineOverride`, `clearRoutineOverride` | skincare\_routines, routine\_items, routine\_item\_overrides, routine\_completions |
| `/my-record/clinic` | My Clinic | Your clinician (with Message Clinician), clinic details, upcoming and completed treatments, treatment history at other clinics (add/delete) | `getPortalClinic`, `addExternalTreatment`, `deleteExternalTreatment` | profiles, clinics, appointments, treatments, external\_treatments |
| `/my-record/records` | My Profile / Records | Personal details and emergency contact (edit), medical history, health update form, treatment timeline, results and labs, clinic documents with in-portal signing, Before & After gallery | `getPortalRecords`, `updatePortalProfile`, `submitHistoryUpdate`, `signDocument` | patients, medical\_history\_versions, treatments, documents, treatment\_photos |
| `/my-record/appointments` | Appointments | Upcoming (confirm) and past treatments | `getPortalClinic`, `confirmAppointment` | appointments, treatments |
| `/my-record/billing` | Billing | Treatments billed (read-only; no payments) | `getPortalClinic` | treatments |
| `/my-record/settings` | Settings | Contact preferences and the email/text log | `getPortalRecords`, `saveCommsPreferences`, `listCommunications` | patients (PECR columns), communications |
| `/my-record/resources` | Resources | Clinic news, your offers (claimed marked), featured retail products | `getPortalHome`, `getMyRecord` | clinic\_news, patient\_offers, retail\_products |

### 4.3 Key patient journeys

1. **Confirm an appointment.** Home card → `confirmAppointment` → SQL `confirm_appointment(p_appointment_id)` (SECURITY DEFINER, only the caller's own, booked, future appointment) stamps `appointments.patient_confirmed_at`. Patients never get UPDATE on `appointments`. The next-appointment card is gated on this column.
2. **Pause a plan.** Timeline → Pause plan → `requestPlanPause` (own plan only, one pending request at a time, audited) → row in `plan_pause_requests` → staff see it in the dashboard Pause requests card with Approve / Decline / Contact → `decidePlanPause` (capability `treatments.record`) sets the plan to `paused`.
3. **Sign a consent form.** Either in Records (`signDocument`, `patientSelf`) or via the emailed magic link `/d/$token` with no session. After signing, `advanceToWaitingIfReady` moves an arrived booking to `waiting` and notifies the practitioner. Signed documents are immutable by trigger.
4. **Submit a health update.** Records → `submitHistoryUpdate` writes a `medical_history_versions` row with `source = patient`; staff mark it reviewed (`reviewHistory`), which feeds the dashboard Attention list.
5. **Message the clinic.** Dock chat → `sendMessage` (author forced from the session) → `messages`; the patient's practitioner (active plan owner, else next booking, else last treatment) gets a `patient_message` bell notification.
6. **Ask the care assistant.** Dock AI → `askCareAssistant` builds context (first name, plan, current step, next appointment) → Cohere. A keyword list (infection, bleeding, swelling, fever, vision, emergency and others) bypasses the model and refers the patient to Messages; the prompt forbids diagnosis and dosage changes; without a key a deterministic fallback answers.
7. **Claim an offer.** Email button → portal → `?offer=<id>` scrolls to and flashes the card → `markOfferViewed` → Claim (`claimOffer`) → `offer_claimed` notification to owner, managers and front desk → Book with this offer opens the dock chat with the code quoted.

### 4.4 Cross-portal sync (what staff see)

| Patient action | Staff surface |
| --- | --- |
| Pause request | Dashboard Pause requests card |
| Journal entry shared with clinic, recovery check-in | Patient record: Patient journal and Recovery check-ins sections |
| Message | Inbox, bell, patient record chat (Realtime channel `patient-messages-<id>`) |
| Consent signed | Diary card stage moves to Waiting; practitioner bell |
| Health update | Dashboard Attention list, History updates tab |
| Offer claimed | Bell, Contact tab Offers card, Offer claimed chip on the diary card |

Staff → patient: milestone updates (`updatePlanMilestone`), completed treatment sessions (visit note appears on the timeline), messages, documents issued, photos marked `visible_to_patient`.

### 4.5 Design lineage

| Version | Date | Artefact | Outcome |
| --- | --- | --- | --- |
| v1 | 12–13 Sep | `docs/patient-portal/v1`: spec, handoff, HTML wireframes (v0.4) | Scope and information architecture |
| v2 | 15 Sep | Wireframe decks for patient and clinic portals, deep-research report, 15 AI-generated reference images | Direction setting |
| v3 | 15 Sep | Interactive Vite app with three patient themes (Lumina, Vivara, Radiant) and three clinic themes (Advanced, Journey, Pastel); 8 reference mockups | Vivara layout chosen as the reference |
| v4 | 22 Sep | Navigable app recreating the 8 mockups in the Aetheria glass theme; comparison sheets | Signed-off design |
| Live | 22–25 Sep | Integrated on `e2e`; visual parity capture at 1672×941 in `v4/comparisons/live` | Current portal |

## 5. Clinic portal

The clinic portal is organised around four daily questions (who is in, what is unfinished, who is this patient, is the book healthy), not around tables; one route per job, with the same `/dashboard` re-titled by role ("Clinic overview" for owner/manager, "Front desk", "My day" for practitioners).

### 5.1 Navigation and access

| Nav group | Items | Gate |
| --- | --- | --- |
| Clinic | Dashboard, Diary (today's count), Patients | Any staff |
| Reports | Insights, Retention, Performance | `reports.insights`, `reports.retention`, `reports.performance` |
| You | Earnings | Practitioners who are not managers |
| Team | Live roster with presence rings (Realtime presence channel `staff-online`) | Any staff |
| Account menu | My profile, Access (admin only), Team, Offers, Settings, Sign out | `view.profile`, admin role, `team.view`, `offers.manage`, `view.settings` |

Toolbar (sticky, transparent, chips fade in over the first 72 px of scroll): Alert team, Sent staff alerts, notification bell, account pill. Keyboard: `/` focuses patient search, `[` toggles the sidebar (238 px default, resizable 180–420 px, persisted in `localStorage`).

### 5.2 Page inventory

| Route | Purpose | Main components | Server functions |
| --- | --- | --- | --- |
| `/dashboard` | Morning huddle: KPIs, today's book, chase list, tasks, notes | `KpiGrid`, `TodaySnapshot` (carousel, day/week), `QuickAddAppointment`, `AttentionList`, `FollowUpTasks`, `PauseRequests`, `TreatmentJourneys`, floating notes | `getDashboard`, `listAppointments`, `getRetention`, `listPatients`, `getCatalogue`, `listPractitioners`, `listAccountsMissingEmail` |
| `/schedule` | Diary (2,607 lines): day planner (practitioner columns, drag to move, click to book), week, month heat-map; guided stage menu; booking dialog with inline new patient and payment mode | `DayPlanner`, `WeekView`, `MonthView`, `StageTracker`, `TreatmentLegend`, `AppointmentTimeEditor`, `VisitNoteChip`, `NoShowFollowUpDialog` | `listAppointments`, `saveAppointment`, `rescheduleAppointment`, `updateAppointmentState`, `sendPaymentRequest`, `resendDocument`, `sendMessage`, `savePatient` |
| `/patients` | Working roster: filters All / Active / Inactive / Treatments due, name and DOB search, multi-select Send offer | glass table, `SendOfferDialog`, new-patient form (`SavePatient` schema) | `listPatients`, `savePatient`, `sendOffer` |
| `/patients/$id` | The clinical object: identity + safety strip, tabs, always-on chat rail | Tabs: Treatments, Visit notes (inside), Before and after (`photos`), Documents, History updates, Contact (preferences, outbox, offers), Portal (journal, check-ins); `TreatmentFormDialog` (`?treat=`), `TreatmentRecordView` (`?record=`), `PatientChatPanel`, `RecallTasksPanel` | `getPatient`, `addTreatment`, `addPhoto`, `sendDocument`, `resendDocument`, `reviewHistory`, `archivePatient`, `markMessagesRead`, treatment-session functions |
| `/insights` | Marketing funnel (sign-ups → consult → treatment), book quality, source mix, bestsellers, "Needs a next step" lists with Send offer | `FunnelTiles`, `FunnelChart`, `SourceMix`, `Bestsellers`, `ActionList`, `PeriodPicker` | `getInsights` |
| `/retention` | Chase desk: rate, one-visit cohort, revenue at risk, trend, where to focus, at-risk table (Overdue / Lapsing / Lost), cohorts | `RetentionTrend`, `SuggestedActions`, `AtRiskTable`, `SendRecallDialog`, `RetentionBreakdown` | `getRetention`, `logRetentionOutreach`, `sendRecall`, recall task functions |
| `/performance` | Earned vs collected vs owed to practitioners, trends, per-practitioner KPIs | `StaffPerformanceKpis`, `PerformanceTrends`, `PerformanceTable` | `getPractitionerPerformance` |
| `/earnings` | A practitioner's own commission book | `MyPerformanceKpis`, `EarningsLinesTable` | `getMyEarnings` |
| `/offers` | Design Your Offer Template: four stage cards with automation switch, optional picture per template (upload or URL; background, top, left, right or bottom), one-off templates, AI drafting, send history | `OfferTemplateEditor`, `OfferAutomationDialog`, `OfferSendHistoryDialog`, `OfferPreview` | `listOfferTemplates`, `saveOfferTemplate`, `previewOfferStage`, `setOfferAutomation`, `draftOfferTemplate`, `listOfferSends`, `archiveOfferTemplate` |
| `/team` | Who can sign in and what they may touch; Current / Former (90-day archive); profile change requests; Staff access grid | `InviteStaffDialog`, `AccessControlSettings`, role select, step-up revoke | `listTeam`, `inviteStaffMember`, `updateStaffMember`, `revokeStaffAccess`, `restoreExTeamMember`, `setStaffPassword`, `listProfileChangeRequests`, `reviewProfileChange`, `setRolePermission` |
| `/team/$id` | Colleague profile: identity, effective permissions, documents or compliance checklist, 1:1 staff chat | `EffectivePermissions`, `StaffFiles`, `StaffDocCompliance`, `StaffChatPanel` | `getStaffProfile`, `updateStaffMember`, `getStaffChat`, `sendStaffChatMessage` |
| `/settings` | Clinic details, treatment catalogue (price, duration, recall interval, consent rule, colour, aftercare points, result template), retail products, insights ingest key | `ClinicDetailsSettings`, `TreatmentCatalogueSettings`, `RetailProductSettings`, `InsightsIntegrationsSettings` | catalogue, colour, theme, retail and clinic-detail functions |
| `/profile` | Own profile, security (password change by emailed code, sessions), own documents | `ProfileAccountTabs`, `SecuritySettings`, `StaffFiles` | `getMyProfile`, `saveMyProfile`, `changeOwnPassword`, `sendPasswordEmailCode`, `listMySessions` |

**Changes from the 26 Sep pull.** Every sidebar item, dashboard card (diary, attention, follow-ups, pause requests, journeys, revenue), patient-list tab (Records, Journey board), record tab and button (Treatments, Before and after, Documents, History updates, From the patient, Contact, upload photos, send documents), Insights tab (Pipeline, Book), Team tab (Current, Former) and shell control (search, alert toolbar, dock) now renders only when `canSee(identity, node)` is true, and a page the caller cannot see redirects to their first visible staff page. Two page-level additions:

| Route | Purpose | Main components | Server functions |
| --- | --- | --- | --- |
| `/access` (new) | Visibility catalogue editor: a tree of pages → tabs → components with one switch per role (Owner fixed on, Practitioner, Receptionist, Patient); a child is disabled when an ancestor is off; a "fixed rules" panel lists what is not a switch | `AccessCatalogueEditor` | `listRolePermissions`, `setRolePermission` (both `accessAdmin`; the page itself admits only the admin role) |
| `/team` (updated) | Collapsible staff search (name, email, title, role, registration), card list capped at five visible with scroll; the owner's Staff access grid now shows capabilities only, the `view.*` keys having moved to `/access` | `StaffSearch`, `StaffCardList`, `AccessControlSettings` | unchanged |

### 5.3 Live floor overlays

- **Floating dock** (bottom-right, `z-[60]`): an **alert bubble** carousel of arrival prompts ("Has X arrived?"), consent-outstanding cards and "X is waiting" cards for the booking's practitioner; and a **chat bubble** inbox of patient threads with unread counts, a thread view and a **voice call** button (Twilio Voice SDK; each patient hashes to a verified demo number; `logCallAttempt` writes a `call` row to the outbox).
- `UrgentStaffAlerts` and `AlertAckToaster`: room, equipment and help-needed alerts raised with `StaffAlertDialog` (`sendStaffAlert`), acknowledged over Realtime.
- `NotificationBell`: deposits, consent, messages, recalls, `patient_waiting` (opens the treatment form), `offer_claimed`; Realtime on `messages` and `staff_notifications`.
- In demo mode an **AI patient** replies to staff chat messages after 4–8 s (Cohere, or a canned pool).

### 5.4 Core staff journeys

1. **Book at the desk.** Quick book or New booking → optional inline new patient → practitioner, catalogue item (fills duration and price), treatment number, time, payment mode (leave unpaid / take payment / send link), visit note → `saveAppointment` (overlap check per practitioner) → booking confirmation and reminders queued in the outbox.
2. **Arrive → treat → complete.** Mark Arrived → auto-Waiting if consent is signed or not required, else "Complete consent in clinic" (typed signature on the clinic device, witnessed by the logged-in staff member) → practitioner notified → three-page treatment form (pre-checks → results and notes → aftercare) → treatment row, photos, plan step and visit note all written on Complete.
3. **Chase.** Attention needed (no-show, deposit due, consent due, balance due, treatment due, messages) → patient `?chase=1` or diary card → send form or payment link (`sendPaymentRequest`) → Contact tab shows preferences and exactly what went out.
4. **Retain.** Retention suggestion or at-risk row → Mark contacted (`logRetentionOutreach`) or Send recall (real marketing send, PECR-checked) → recall task on the dashboard My tasks.
5. **Market.** Design a stage template (optionally Draft with AI) → switch on automation (runs on each outbox drain) or send one-off from the record, the patient table (bulk) or Insights.
6. **Offboard.** Team → revoke (step-up) → auth user banned, 90-day Former archive → restore or automatic purge of HR data (clinical records are never deleted).

## 6. UI/UX and design system

Both portals share one visual system, "Bright Pastels on Notebook Lines": translucent glass cards on a paper-and-ruled-line wash, butter-gold primary actions, Space Grotesk throughout, and colour reserved for meaning. All tokens live in `src/styles.css` (1,063 lines), mapped into Tailwind 4 through an `@theme inline` block.

### 6.1 Tokens

| Token | Value | Meaning |
| --- | --- | --- |
| `--background` | `#f6f7f8` + yellow and peach radial blooms + 14 px ruled lines | Page wash; must stay visible through glass |
| `--foreground` / `--ink-2` / `--ink-3` | `#2f3f66` / `#46557a` / `#6a7390` | Primary, secondary, meta text |
| `--glass` / `--glass-2` | white 82% / 62% | Cards / inset wells and inputs |
| `--accent` / `--accent-hi` / `--accent-ink` | `#eed488` / `#faedc2` / `#7a6220` | Primary CTA, active nav, confirmed |
| `--success` | `#4a9d75` | Done, paid, complete |
| `--consent` | `#b9a6e8` | Waiting on someone (consent, waiting stage) |
| `--sky` | `#8fc7ea` | Arrived, informational |
| `--destructive` | `#dc6c96` | Urgent, no-show, unpaid, overdue |
| `--aftercare` | `#ef9bc4` | Aftercare stage only |
| `--lane-1` … `--lane-8` | eight pastels | Staff avatar lanes |
| `--radius` | 0.875 rem base; cards 22 px, wells 11 px, pills full | Hierarchical radius |

Typography: page title 22 px/600, section title 17 px/600, KPI figures 27 px tabular, body 13.5 px, meta 11 px. Money is always `en-GB` GBP.

### 6.2 House rules (enforced by `.cursor/rules`)

- **No left accent rails** on cards, rows, popovers or dialogs; status is carried by wash, chip, avatar and sheen.
- **Pill controls sit right of the title on the same row** (`.page-header` aligns the last child to the title line); one track style, one active style (`bg-accent-soft` + inset edge), full-word labels.
- Colour is semantic: green finished, lilac waiting, rose urgent. Diary events are coloured by **treatment**, not practitioner (owner-editable colours and saved colour themes).
- Tables are hand-rolled `glass-table`, not a data grid; empty states are dashed glass wells with one sentence.

### 6.3 Component system

- **Primitives** (`components/ui`, 46 files): shadcn/Radix rebuilt as glass (Card with blur and sheen, butter-gradient Button, tinted Badge, segmented Tabs, frosted Dialog scrims, Sonner toasts styled `.aetheria-toast`). The Aug audit found 29 of 46 unused.
- **Clinic blocks:** `AppShell`, `BrandMark`/`BrandLockup` (Æ gold tile), `PeriodPicker` (year default, custom range), `QuickAddAppointment`, `VisitNoteChip`, `RiskBadge`, `PatientAvatar`, `PractitionerHoverCard`, `PatientChatPanel` / `StaffChatPanel` (resizable 280–520 px rail), `NotificationBell`, `FloatingDock`.
- **Portal blocks** (`components/portal/ui.tsx`): stat tile, progress ring, pill tabs, milestone track, interactive sliders, photo block, banner, note callout, equal-height card grid.
- **Editors:** `RichNotesEditor` and `IosNotesEditor` on Tiptap; HTML sanitised with a regex sanitiser (`sanitize-note-html.ts`).

### 6.4 UX patterns worth preserving

- One page, role-shaped copy (dashboard titles, KPI labels that say whose book they count).
- Status on the card: payment, consent and stage chips on every diary card so reception never opens a second screen.
- Deep links as workflow glue: `?view=due`, `?chase=1`, `?tab=photos`, `?treat=<appointmentId>`, `?record=<treatmentId>`, `?offer=<id>`.
- Honest copy: toasts describe what actually happened ("posted to their patient portal" until real sends existed).
- Guided state changes: invalid stage options are disabled with the reason inline.

### 6.5 Screenshot and wireframe index

| Set | Location | Count | What it captures |
| --- | --- | --- | --- |
| Clinic portal guide | `docs/clinic-portal/screenshots` | 24 | Every staff page as owner, practitioner and receptionist, plus a 390 px mobile dashboard (13 Sep, demo) |
| Audit captures | `docs/audit-screenshots` (+ `flows/`) | 9 + 18 | Pre-remediation state (Aug): per-role flows and mobile views that showed clipped content |
| Patient portal v2 | `docs/patient-portal/v2` | 15 + 16 assets | AI-generated reference images and wireframe decks |
| Patient portal v3 mockups | `docs/patient-portal/v3/mockups` | 8 | Reference layouts (Home, Plan overview, Timeline, Journal, Routine ×2, My Clinic, Records) |
| V4 comparisons | `docs/patient-portal/v4/comparisons` (+ `live/`) | 8 + 7 + 7 shots | Mockup vs V4 vs live portal side by side at 1672×941 |
| Repo root | `commits.png`, `sh-1.png`, `sh-2.png` | 3 | GitHub commit list for 23–24 Aug; the Node < 22 "native WebSocket not found" error card |
| Playwright failure | `test-results/` | 1 context | `reminders.spec.ts` expected 4 queued reminders, found 0 |
| RBAC access baseline | `docs/rbac/screenshots` | 50 | Every page as owner, practitioner, receptionist and patient before the live access editor, including the redirects a denied role gets (26 Sep); indexed in docs/rbac/access-catalogue.md |

Capture scripts: `docs/clinic-portal/capture-screens.mjs` (demo on port 5174, `demo_role` cookie, hides the role switcher and alert stack), `docs/audit-screenshots/capture.mjs`, `docs/patient-portal/v4/scripts/capture.mjs`, and `scripts/qc-patient-portal.mjs`, `qc-floating-dock.mjs`, `qc-voice-ai.mjs`.

## 7. Backend and Supabase

The database is a 52-table Postgres schema in one Supabase project, multi-tenant by `clinic_id` on 43 tables, with RLS on every table, RESTRICTIVE clinic-isolation policies, immutability and no-hard-delete triggers, and a handful of SECURITY DEFINER RPCs; application traffic bypasses RLS via the service role, so these controls are the second line behind the app layer.

### 7.1 Table catalogue by domain

| Domain | Tables |
| --- | --- |
| Tenant and identity | `clinics` (name, contact, `reminder_offsets` hours, insights ingest key hash), `profiles` (staff, `commission_rate`, registration body/number), `user_roles`, `role_permissions` (per clinic; capability and view.\* grants, including rows for the patient role), `profile_change_requests`, `ex_team_members` (90-day archive), `staff_documents`, `user_notes` |
| Patients | `patients` (identity, clinical summary: allergies, medications, conditions; address and emergency contact; PECR flags `email_opt_in`, `sms_opt_in`, `reminders_opt_in`, `marketing_opt_in`, `unsubscribed_at`; retention: `deleted_at`, `deletion_reason`, `legal_hold`; `user_id` unique link to Auth), `medical_history_versions`, `external_treatments` |
| Diary | `appointments` (`status` booked/attended/cancelled/no\_show, `stage` visit stage, `payment_status`, `consent_document_id`, `patient_confirmed_at`, `catalogue_id`, price, treatment number), `appointment_notes` (one per appointment) |
| Clinical record | `treatments` (area, product, dose, price, `next_due_at`, `commission_rate_snapshot`, `appointment_id`, `consent_document_id`), `treatment_sessions` (the three-page form: `pre_checks`, `results`, notes, `aftercare_points`, status started → treating → aftercare → complete), `treatment_photos` (before/after, `visible_to_patient`, `marketing_consent`), `documents` (consent, consultation, treatment plan, aftercare, other; status draft/sent/viewed/signed/expired; `access_token`, `expires_at`, signature fields, `witnessed_by`), `document_access_events` |
| Plans (journeys) | `treatment_plans` (phase consult/foundation/build/results, status incl. `paused`, `kind`, strapline, `duration_days`, `total_sessions`), `plan_milestones` (session/task/conditional, month grouping, guidance), `plan_milestone_checklist` (`clinic_owned` items patients cannot tick), `plan_pause_requests` |
| Patient self-care | `journal_entries`, `journal_attachments` (photo/voice), `recovery_checkins`, `routine_completions`, `skincare_routines`, `routine_items`, `routine_item_overrides` |
| Clinic content | `treatment_catalogue` (price, duration, `interval_days`, `requires_consent`, `cooling_off_hours`, `aftercare_points[]`, `result_template`), `treatment_colours`, `treatment_colour_themes`, `clinic_news`, `clinic_offers`, `retail_products`, `message_templates` |
| Messaging and alerts | `messages` (patient ↔ clinic thread, attachments JSON, `read_at`), `staff_notifications` (kind, urgent, per-recipient and per-sender dismiss), `staff_conversations`, `staff_chat_messages`, `staff_conversation_reads` |
| Comms outbox | `communications` (channel email/sms/call, purpose transactional/reminder/marketing, status queued/sending/sent/failed/bounced/cancelled, attempts, `scheduled_for`, provider ids, `body_html`, related entity) |
| Retention and marketing | `recall_tasks` (open/contacted/completed, assignment), `retention_outreach` (links to `communication_id`), `offer_templates`, `patient_offers` (both with image\_url and image\_placement since 26 Sep), `website_leads`, `product_sales` |
| Audit and auth | `audit_log` (actor, action, entity, patient, meta), `auth_login_events`, `auth_email_otp`, `auth_step_up` |

Core relationships: `clinics` 1–n everything; `patients` 1–n appointments, treatments, documents, photos, messages, plans, communications, offers; `appointments` 1–1 `treatment_sessions` and `appointment_notes`, n–1 `treatment_catalogue`, optional consent `documents`; `treatments` n–1 appointment and plan milestone (via `plan_milestones.appointment_id`); `profiles.id` = `auth.users.id` and is the `practitioner_id` everywhere.

### 7.2 Enums

`app_role` (owner, practitioner, front\_desk, patient, manager, admin) · `visit_stage` (booked, arrived, waiting, in\_treatment, aftercare, complete, no\_show) · `appointment_status` · `payment_status` (unpaid, deposit\_paid, paid, refunded) · `document_kind` / `document_status` · `communication_channel` / `_purpose` / `_status` · `recall_task_status` · `treatment_plan_phase` / `_status` · `plan_milestone_kind` / `_status` · `plan_pause_status` · `journal_entry_kind` / `journal_attachment_kind` · `routine_period` · `photo_kind` · `message_author` · `patient_status` · `change_request_status`.

### 7.3 RLS and grant model

- **Per-table pattern** (house style since the plans migration): `"staff manage <table>"` FOR ALL using `is_staff(auth.uid())`; `"patients read own <table>"` using `patient_id = current_patient_id()`; patient-writable self-care tables add insert/update/delete on own rows; plus a RESTRICTIVE `clinic_isolation` policy (`clinic_id = current_clinic_id()`).
- **Grants** (Phase 5): `anon` has SELECT only; `authenticated` keeps INSERT/UPDATE/DELETE (governed by RLS) but not TRUNCATE; `ALTER DEFAULT PRIVILEGES` applies the same to future tables.
- **Owner-only writes** on `role_permissions`; `user_roles` forbids an owner removing their own role.

### 7.4 SQL functions, triggers, storage, realtime

| Kind | Name | Purpose |
| --- | --- | --- |
| RPC | `has_role`, `is_staff`, `is_owner` | Role checks used by policies; is\_staff includes admin since the access-catalogue migration |
| RPC | `current_clinic_id()`, `current_patient_id()` | Caller's tenant and patient row for policies |
| RPC | `confirm_appointment(p_appointment_id)` | Patient confirms own future booking |
| RPC | `claim_queued_communications(_limit)` | Row-locking claim for the drain; service role only |
| RPC | `check_login_throttle`, `record_login_event` | Login lockout; callable by anon, fail-open if missing |
| RPC | `match_reauthentication_otp` | Email-code verification |
| RPC | `patient_retain_until(id)`, `erase_patient(id, reason)` | 8-year retention clock; the only hard-delete door (refuses under legal hold or inside the window, audits first) |
| Trigger | `on_auth_user_created` → `handle_new_user` | Creates `profiles`; links one patient by email |
| Trigger | `documents_signed_immutable` | Rejects any change or delete of a signed document |
| Trigger | `patients_no_hard_delete` | Blocks `DELETE` on patients outside `erase_patient` |
| Trigger | `*_updated` (×14) | `updated_at` maintenance |
| Constraint | practitioner no-overlap | GiST exclusion constraint appointments\_no\_practitioner\_overlap: no two non-cancelled bookings overlap for one practitioner (also pre-checked in the app) |
| Storage | `patient-photos`, `message-attachments`, `staff-files` | Staff read/write; patients read/upload own message attachments; staff files by owner. A fourth, public bucket offer-images holds offer pictures |
| Realtime | `messages`, `staff_notifications`, `staff_chat_messages`, `staff_conversation_reads`, `role_permissions`, `user_roles` | Bell, chat, live identity refresh |

### 7.5 Migration history (70 files)

| Window | Migrations | What landed |
| --- | --- | --- |
| 11–15 Aug | 33 (Lovable-generated UUID names) | Base schema: clinics, profiles, roles, patients, appointments, treatments, documents, photos, messages, history, notifications, catalogue, colours, templates, recall, outreach, notes, role permissions, realtime |
| 19–23 Aug | 10 | Catalogue duration, practitioner overlap, recall reassign, notification sender read and dismiss, staff chat + attachments, manager role, ex-team archive, front desk team view |
| 24–26 Aug | 7 | Phase 3 capability keys; Phase 5 grants, unique patient identity, signed immutability, retention, clinic isolation, 9 indexes |
| 10–15 Sep | 7 | Login throttle, step-up, email OTP (+ reauth), comms outbox, drain RPC, Phase 9 flows and reminders |
| 17–20 Sep | 2 | Treatment plans, insights (leads, retail, sales, ingest key) |
| 22–26 Sep | 11 | Portal (plan detail, self-care, content, profile), appointment confirmation, plan kind, routine overrides, treatment sessions and workflow columns, catalogue result template, offers |
| 27–28 Sep (file dates; committed 25 Sep) | 3 | admin value on app\_role; is\_staff() with admin plus default view.\* grants seeded for every clinic; offer image columns and the public offer-images bucket |

`scripts/apply-migrations.mjs` is ledger-aware (`--only` to hold one back); `scripts/db-snapshot.mjs` prints grants, policies, triggers, indexes, row counts and the ledger for before/after diffs. The worklog records 57 applied remotely as of 15 Sep; the 16 migrations since then (17–28 Sep) carry "apply to live" notes in their work logs and should be confirmed against the ledger.

### 7.6 Data on hand

- **Live project** (`patientsys`): not reachable from this session (network egress blocks `*.supabase.co` and the pooler), so figures come from the work log. At Phase 5 (26 Aug) it held 1 clinic and 5 patients; staff were the owner, two practitioners, one front desk, a disposable `manager` test account and one portal patient test account; `audit_log` had \~200 rows. One locked-out account and one orphan invite profile predate remediation.
- **Demo fixture** (`src/lib/demo/data.ts`, seeded PRNG `mulberry32(20260816)`, dates relative to today): clinic "Aetheria Medical" (Marylebone, London; reminders at 168 h and 24 h); owner Dr Amara Osei, practitioners Dr Nadia Rahman and Dr Tom Whitfield, front desk Sofia Marchetti, former Dr Helen Cho; portal patient Olivia Bennett; software admin "Software developer" (developer@aetheria.clinic, added 25 Sep); 31 catalogue items; \~641 patients (41 named + 600 generated), with treatments, appointments, documents, photos, messages, plans, sessions, offers, leads and sales derived from them. The demo drives every screenshot and every Playwright test.

## 8. Low-level design (LLD)

The domain logic is split between one large server-function module (I/O, authorization, persistence) and small pure modules (`visit-stage.ts`, `offers/stages.ts`, `offers/cohorts.ts`, `retention.server.ts`, `earnings.server.ts`, `insights.server.ts`, `portal/shape.ts`, `comms/preferences.ts`) that production, demo and the UI all import, so the rules cannot drift between them.

### 8.1 Server-function anatomy

```typescript
// src/lib/clinic.functions.ts (simplified)
export const saveAppointment = createServerFn({ method: "POST" })
  // 1. zod validation with friendly error messages
  .validator((data: SaveAppointmentInput) =>
    parseInput(schemas.SaveAppointment, data))
  // 2. verify JWT, build Ctx with a clinic-scoped service client
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // 3. POLICY rule: capability appointments.edit
    await authorize(context as Ctx, "saveAppointment");
    const supabase = (context as Ctx).supabase;

    // 4. domain guard
    await assertNoPractitionerOverlap(supabase, { ... });

    // 5. write
    await supabase
      .from("appointments")
      .update(payload)
      .eq("id", data.id);

    // 6. audit trail (logs, never throws)
    await audit(context as Ctx, "update", "appointment",
      data.id, data.patient_id);

    // 7. side effects: confirmation and reminders
    //    via enqueueCommunication()
  });
```

Conventions: GET for reads, POST for writes; `clinicIdOf(ctx)` for inserts; `adminClient(ctx)` when the Auth admin API or a patient-initiated write to a staff-only table is needed (still clinic-scoped); `audit()` logs but never throws because the mutation has already committed; demo twins export identical names and signatures.

### 8.2 Handler catalogue by domain

| Domain | Handlers (access) |
| --- | --- |
| Session and security (9) | `getMe`, `changeOwnPassword`, `sendPasswordEmailCode`, `acknowledgeWelcome`, `confirmStepUp`, `listMySessions`, `revokeOtherSessions` (self); `sendLoginEmailCode`, `verifyLoginEmailCode` (manager) |
| Dashboard and patient reads | `listPatients`, `getCatalogue`, `listPractitioners` (staff); `getDashboard` (view.dashboard); `getPatient` (staffOrOwnPatient, staff side needs view.patients); `getPatientMetrics` (reports.insights) |
| Diary | `listAppointments`, `getPractitionerDay`, `getAppointmentNote` (staff); `saveAppointment`, `updateAppointmentState`, `rescheduleAppointment` (appointments.edit); `saveAppointmentNote` (treatments.record) |
| Clinical record | `savePatient` (patients.edit); `archivePatient` (owner); `addTreatment`, `reviewHistory` (treatments.record); `addPhoto`, `deletePhoto` (photos.manage); `sendDocument`, `resendDocument`, `completeConsentInClinic` (documents.send); `getAppointmentConsent` (staff) |
| Plans and treatment form | `listTreatmentPlans`, `getTreatmentSession`, `getTreatmentRecord`, `listPlanPauseRequests` (staff); `createTreatmentPlan`, `updatePlanMilestone`, `startTreatment`, `moveToAftercare`, `completeTreatment`, `saveTreatmentSessionDraft`, `decidePlanPause` (treatments.record) |
| Messaging and comms | `sendMessage`, `listCommunications` (staffOrOwnPatient + comms.send for staff); `getPatientMessages`, `markMessagesRead`, `saveCommsPreferences` (staffOrOwnPatient); `sendPaymentRequest`, `enqueueCommunication`, `drainCommunications`, `sendStaffAlert`, `sendRecall`, `sendOffer` (comms.send); `listPatientThreads`, voice config/token/target, `logCallAttempt`, templates (staff); `deleteMessageTemplate` (owner); `getUnreadMessages` (self) |
| Patient portal (25) | `getMyRecord`, 7 `getPortal*` reads (plan, timeline, journal and routine also need their view.portal.\* key), journal, check-in, pause, confirm, routine (complete, snooze, extract, override, clear), checklist, profile, external treatments, `askCareAssistant`, `submitHistoryUpdate` (all self); `signDocument`, `markOfferViewed`, `claimOffer` (patientSelf) |
| Staff notifications and chat | list/directory/sent/incoming alerts, mark read, `getStaffChat`, `sendStaffChatMessage`, `markStaffChatRead` (staff); dismiss single/bulk (notifications.delete) |
| Team administration | `listTeam`, `getStaffProfile` (staff); `listExTeamMembers` (team.view); create/invite/revoke/restore staff, set password/email, patient email, commission, accounts missing email (owner); `updateStaffMember` (manager) |
| Own profile | `getMyProfile` (view.profile), `saveMyProfile`, `setMyAvatar`, `submitProfileChange`, own documents (staff); `getMyNote`, `saveMyNote` (self); change-request review (team.approve\_changes) |
| Reports | `getInsights` (reports.insights), `getPractitionerPerformance` (reports.performance), `getRetention` (reports.retention), `getMyEarnings` (view.earnings), `logRetentionOutreach` (staff) |
| Offers | `listOfferTemplates`, `listPatientOffers` (staff); save/archive/automation/draft/preview/sends (offers.manage) |
| Recall tasks | create, status, list, open list (staff); `updateRecallTask` (manager); `deleteRecallTask` (tasks.delete) |
| Settings | `listTreatmentColours`, `getClinicDetails`, `listRetailProducts` (staff); colours, themes, catalogue, clinic details, retail (settings.treatments); `listRolePermissions`, `setRolePermission` (accessAdmin: owner or admin, roles manager / practitioner / front desk / patient); ingest key status/rotate (owner) |

### 8.3 Visit stage machine and treatment form

&#91;image: Visit stage machine: booked, arrived, waiting, in treatment, aftercare, complete, no show\]

Rules live in `lib/visit-stage.ts` (pure) and `lib/visit-stage.server.ts` (I/O). `consentState` returns `signed`, `not_required` or `outstanding`, but `consentReady` accepts only `signed`: since the 25 Sep consent change, every treatment needs a signed form before Waiting, even when the catalogue does not require one in advance. `advanceToWaitingIfReady` runs after arrival, after in-clinic signing, after portal signing and after magic-link signing; on reaching Waiting it inserts a `patient_waiting` staff notification for the booking's practitioner (owners and managers if unassigned). `holdArrivedUntilConsent` corrects any stale Waiting rows on read. The manual menu (`manualStageOptions`) disables Waiting with the reason and routes In treatment to the form.

**Treatment form** (`TreatmentFormDialog`, `?treat=<appointmentId>`), one `treatment_sessions` row per appointment:

| Step | Server call | Effect |
| --- | --- | --- |
| Open | `getTreatmentSession` | Appointment, patient safety data, consent state, draft, last five visit notes, last same-type treatment, aftercare points, pre-check template, photos, plan step |
| Page 1 | `startTreatment(pre_checks)` | Refused unless `canStartTreatment`; five Yes / No / N/A checks, a No needs a note; stage → `in_treatment` |
| Page 2 | `moveToAftercare(results, notes)` | Results (area, product, dose, prefilled from last same-type); visit note written to `appointment_notes` now; photos uploaded against the appointment; stage → `aftercare` |
| Page 3 | `completeTreatment(aftercare_points)` | Inserts `treatments` (price from booking, `next_due_at` from `interval_days`, commission snapshot, consent and appointment links); re-points photos; marks the plan milestone done; stage → `complete`; updates `patients.last_visit_at`; idempotent |
| Any time | `saveTreatmentSessionDraft` | Debounced autosave through a ref, cancelled by page mutations |
| After | `getTreatmentRecord` | Printable record view (`TreatmentRecordView`) |

### 8.4 Comms outbox pipeline

1. **Enqueue** (`enqueueCommunication`, the only insert): resolves the address, applies `assertCanSend` (PECR), inserts `queued` with `scheduled_for` (now, or a future reminder time).
2. **Claim**: live drain uses `claim_queued_communications` (row lock) or a select + optimistic update fallback; rows go to `sending` and the lock clock is stamped to now; `sending` rows older than 5 minutes are reclaimable.
3. **Deliver** (`deliverRow`): SMS via Twilio Messages; email via Resend with text + optional HTML; non-transactional email gets an HMAC one-click unsubscribe footer (`/u/$token`). Sandbox when demo, `COMMS_SANDBOX=1` or the key is missing: logs destination and subject only, marks `sent` with provider `sandbox`.
4. **Outcome** (`applyDelivery`): success → `sent` with provider id; failure → back to `queued` with backoff `min(15 × 2^(n−1), 3600)` s; 8 attempts → `failed`.
5. **Webhooks**: `/api/comms/webhooks/resend` (Svix HMAC) and `/twilio` (SHA1), fail closed; delivered → `sent`, bounce/complaint/undelivered → `bounced`.
6. **Triggers of sends**: booking confirmation, time-change notice, reminders at `clinics.reminder_offsets` (default 168 h and 24 h; cancelled and requeued on reschedule), consent magic link (14-day token), payment/deposit link, recall (marketing), staff invite (Supabase `inviteUserByEmail`), offers (marketing; automation runs at the start of each drain).

**PECR truth table** (`comms/preferences.ts`): no address → refuse; transactional → always send; `unsubscribed_at` set → refuse reminder and marketing; reminder → needs `reminders_opt_in` (default on); marketing → needs `marketing_opt_in` plus the channel's `email_opt_in` or `sms_opt_in` (default off).

### 8.5 Consent magic link

`sendDocument` issues a document with a unique `access_token` (pgcrypto) and 14-day expiry and emails `/d/$token`. The public page calls `GET /api/documents/access/$token` (unknown, malformed and expired all return one uniform 404; already signed returns 409) and `POST` to sign with a typed name and optional contraindication answers. Signing records name, IP and user agent, is single-use through the immutability trigger, logs `document_access_events` (views, signatures, rejections, IP throttle) and runs the Waiting rule.

### 8.6 Report engines

| Engine | Core rules |
| --- | --- |
| Retention (`retention.server.ts`) | Per patient: last treatment, latest `next_due_at`. Risk: >180 days since last visit = Lost; overdue next-due = Overdue; 90–180 days = Lapsing. Rolling return-rate windows (1 m weekly, 6 m, 1 y, 5 y), cohorts (2nd and 3rd visit conversion), repeat rate by treatment, revenue at risk. Practitioners see their own book |
| Earnings (`earnings.server.ts`) | Earned = Σ price × (`commission_rate_snapshot` or current rate); collected share by payment status; clinic retained = earned − practitioner share; period-over-period change chips |
| Insights (`insights.server.ts`) | Funnel sign-ups (patients + `website_leads`) → consultation (catalogue category or /consult/) → first treatment; sources website / instagram / referral / walk-in / other; bestsellers from treatments and `product_sales`; action lists "Waiting for a first booking" and "Consulted, no treatment yet". External events arrive at `POST /api/insights/events` with a per-clinic bearer key stored as a SHA-256 hash |
| Offers (`offers/*`) | Stages: pre-consultation (delay 0 d), post-consultation with nothing booked (7 d), single treatment (21 d), plan ending (≤ 1 session left or > 80% of duration, 0 d). Cohort minus already offered, inside delay, or without consent; once per patient per stage for automation (partial unique index); one code path `sendOfferToPatients` for every surface. Optional picture (image\_url, image\_placement: background, top, left, right or bottom) snapshotted onto each patient\_offers row; offers/picture.ts renders it as table-based email HTML, OfferArt / OfferCardPreview on the portal card |

### 8.7 Frontend state and realtime

- **Identity:** `useIdentity()` = query `["me"]` on `getMe`, `staleTime: 0`, refetch on focus and every 30 s, plus a Realtime channel on `role_permissions` and `user_roles` so a permission change reaches open sessions.
- **Query keys** mirror handlers (`["dashboard"]`, `["appointments", from, to]`, `["patient", id]`, `["portal-home"]`, `["retention", from, to, period]`); mutations invalidate by prefix.
- **Realtime channels:** `message-alerts`, `staff-notification-alerts`, `staff-alert-acks:<uid>`, `staff-chat-<conversation>`, `patient-messages-<patientId>`, `staff-online` (presence), recall task sync. Demo mode has no Realtime and polls (e.g. the bell every 4 s).
- **Floating state:** `FloatingDockProvider` and `FloatingNotesProvider` sit above the routes so pages can register chat context with the dock.

### 8.8 Validation

\~114 zod schemas in `validation/schemas.ts` built on shared primitives (trimmed strings, numeric text, dates, enums); `parseInput` flattens failures to one sentence and a global `z.setErrorMap` gives the same wording in forms via `zodResolver`. No schema uses `.uuid()` because demo ids are not UUIDs. `npm run check:validators` fails on pass-through validators, unused schemas, prod/demo mismatch or schema/type field drift.

### 8.9 Demo layer

`vite.config.ts` registers `aetheria:demo-data-layer`, which resolves any import of `clinic.functions.ts` to `clinic.functions.demo.ts` when `DEMO=1`, and defines `__DEMO_MODE__` / `__DEMO_NOW__`. The demo twin reads identity from the `demo_role` cookie, mutates the in-memory `db` object (lost on restart), mirrors every rule through the shared pure modules, uses sandbox comms, and runs AI features (patient replies, care assistant, offer drafting) with canned fallbacks. `guards.server.ts` never loads in demo, so demo is looser on authorization than production.

### 8.10 Access catalogue (added 26 Sep)

`src/lib/access-catalogue.ts` declares `ACCESS_CATALOGUE`: 58 nodes, each `{ id, parentId, kind: page | tab | component, label, route, permission, columns, defaults }`. Staff nodes offer switches for practitioner and front desk (manager defaults on); portal nodes (`view.portal.*`) offer a switch for patients. Some nodes reuse capability keys (for example "Delete follow-up tasks" is `tasks.delete`, off by default below manager).

| Function | Rule |
| --- | --- |
| `canSee(identity, nodeId)` | True only if the node's key **and every ancestor's key** pass `can()`; owner and admin always pass |
| `pageNodeForPath(pathname)` | Most specific page node for a URL (exact match beats prefix; `$param` routes match by pattern) |
| `firstVisibleStaffPath` / `firstVisiblePortalPath` | Redirect target when a page is hidden (falls back to `/profile` for staff) |
| `isAccessAdmin(identity)` | Admin and not owner: the only caller the `/access` page admits |
| `catalogueGrantRows()` / `viewGrantRows()` | Default grant rows, used to seed `role_permissions` (mirrors the migration's `VALUES` list) |

Flow: the admin flips a switch in `AccessCatalogueEditor` → `setRolePermission(role, key, enabled)` upserts `role_permissions` → Realtime on `role_permissions` invalidates `["me"]` in every open session → `getMe` returns the new `permissions` → `IdentityGate`, `AppShell` and each page re-render with `canSee`. A child switch is disabled while an ancestor is off. Fixed rules shown in the editor: the owner column cannot be turned off; `/access` itself is not a grant; patients never enter the clinic and staff never enter the live portal; practitioner own-book scoping is a data rule; archive, invite and revoke stay owner-only.

`docs/rbac/access-catalogue.md` records the pre-editor baseline and six mismatches it was built to remove (Earnings open to any staff by URL, Settings reachable without the menu item, Performance double-gated, Retention with no client redirect, receptionist seeing buttons the server refuses, practitioner own-book scope).

## 9. Testing and Playwright automation

Verification is layered: three static checks that fail the build on missing authorization, validation or tenancy classification; \~133 Vitest unit tests over the pure rules; \~107 Playwright test declarations (130 executed, since some are generated per route or persona) over the whole product in demo mode; and, during remediation, manual "verify by attack" runs against the live project. `npm run verify` runs all of it and CI runs it on every push to `main` and every PR.

### 9.1 Static checks

| Check | Script | Fails when | Last recorded |
| --- | --- | --- | --- |
| Policy | `scripts/check-policy.mjs` | A server function has no `POLICY` entry, never calls `authorize`, or the map names a handler that does not exist | 161 handlers, all passing (re-run at b2e554e, 26 Sep) |
| Validators | `scripts/check-validators.mjs` | A validator passes input through, a schema is unused, prod and demo schemas differ, or schema fields drift from declared types | 115 validators, prod and demo in step (26 Sep) |
| Tenancy | `scripts/check-tenancy.mjs` | A table in `types.ts` is neither clinic-scoped nor knowingly exempt; raw `supabaseAdmin` use exceeds the allowlist (4) | 52 tables: 43 clinic-scoped, 9 exempt (26 Sep) |
| Types | `npx tsc --noEmit` | Not gated; tracked as a delta against the branch baseline | \~50–60 errors, no new ones per phase |
| Lint | `npm run lint` | Non-blocking in CI until Phase 11 (\~2,900 pre-existing findings) | — |

### 9.2 Unit tests (`tests/unit`, Vitest, node environment)

| File | Tests | Covers |
| --- | --- | --- |
| `offers-stages.test.ts` | 17 | Stage classification, delays, rendering (incl. offer pictures in email and card), claim URL, expiry |
| `comms-templates.test.ts` | 13 | Template rendering, channels, reminder times |
| `visit-stage.test.ts` | 13 | Consent state, Waiting rule, guided menu, pre-checks, aftercare defaults |
| `comms-preferences.test.ts` | 11 | PECR truth table, unsubscribe stamping |
| `payment-link.test.ts` | 9 | Payment and booking message builders |
| `comms-dispatch.test.ts` | 8 | Claim, stale reclaim, backoff, max attempts |
| `document-access.test.ts` | 8 | Token resolution, uniform not-found, single-use signing |
| `insights.test.ts` | 7 | Funnel, sources, consultation detection |
| `period-picker.test.ts` | 7 | Period windows, custom ranges |
| `policy-scope.test.ts` | 7 | `resolveScope` rules |
| `comms-config.test.ts` | 6 | Sandbox decision, backoff formula |
| `comms-webhooks.test.ts` | 6 | Svix and Twilio signature verification |
| `offers-send.test.ts` | 6 | Send path: email + link, portal-only, skipped, archived |
| `permissions.test.ts` | 6 | `can()`, owner implicit grants, logged-out redirect |
| `comms-unsubscribe.test.ts` | 4 | HMAC token round trip |
| `access-catalogue.test.ts` | 5 | canSee ancestry, owner and admin pass-through, path-to-node matching, redirect targets, seeded grant rows (added 26 Sep) |

### 9.3 End-to-end (`e2e/`, Playwright, Chromium)

Harness: `playwright.config.ts` boots `vite dev --port 8091` with `DEMO=1`, a fresh server per run (fixtures are mutable), one worker, serial; retries 2 in CI; trace on first retry. `e2e/fixtures.ts` sets the `demo_role` cookie per spec (`test.use({ role })`), hides the demo switcher and staff dock so corners stay clickable, and computes dates from the real clock (`localDateTime`).

| Spec | Tests | What it proves |
| --- | --- | --- |
| `patient-portal/controls.spec.ts` | 20 | Every portal control acts: confirm, reschedule, quick actions, sliders, pause modal validation, journal filters and new entry, routine complete/snooze/override, records edits, chat and AI bubbles |
| `patient-portal/navigation.spec.ts` | 10 | Every nav item, sub-tab and deep link with active state; patients cannot reach staff routes and staff cannot use the portal subtree |
| `patient-portal/pages.spec.ts` | 8 | Each page renders every V4 element with zero console or page errors |
| `patient-portal/sync.spec.ts` | 6 | Staff message and milestone reach the patient; patient pause and journal reach staff |
| `feedback-corrections.spec.ts` | 9 | Carousel, scoped KPIs, retention period, insights drill-down, pause Contact, journey card |
| `offers.spec.ts` | 9 | Capability gating via Team matrix, stage cards, AI draft fallback, automation preview → drain, record/bulk/Insights sends, portal claim, bell, diary chip |
| `rbac.spec.ts` | 8 | Owner, practitioner and front desk route access and redirects |
| `portal.spec.ts` | 6 | Portal signing and core patient paths |
| `treatment-workflow.spec.ts` | 5 | Arrival → auto-Waiting; consent in clinic with witness; magic-link signing → Waiting; full three-page form from the bell; completed session on the patient timeline |
| `consent-magic-link.spec.ts` | 4 | Public signing, replay refused, bad and expired tokens indistinguishable |
| `patients.spec.ts`, `retention.spec.ts`, `schedule.spec.ts`, `smoke.spec.ts`, `team.spec.ts` | 3 each | Patient list and record, retention actions, booking as owner and front desk, smoke across routes, team admin |
| `comms.spec.ts`, `documents.spec.ts`, `unsubscribe.spec.ts` | 2 each | Outbox drain, document issue/remind, public unsubscribe |
| `reminders.spec.ts` | 1 | Booking ahead queues reminders and a reschedule supersedes them — **failing** |

**Last run:** 130 passed; `reminders.spec.ts` fails identically at every branch point since the treatment workflow (the saved error context expects 4 queued "appointment reminder" rows and finds 0). Worth fixing first, since it guards reminder scheduling.

### 9.4 QC and screenshot automation

`scripts/qc-patient-portal.mjs`, `qc-floating-dock.mjs` and `qc-voice-ai.mjs` drive Playwright through the portal, dock and voice/AI flows for visual QC; the capture scripts in `docs/` regenerate the guide screenshots and the V4 parity sheets.

### 9.5 What is not covered

- Live Supabase: RLS, triggers and auth flows (MFA, OAuth, reset, throttle) are verified only manually; demo bypasses auth by design.
- Practitioner and front-desk sessions were never exercised against live during Phases 2–3 (no passwords set).
- No live Resend or Twilio send, bounce or webhook has been observed.
- No load, accessibility or cross-browser (non-Chromium) testing.

## 10. Commit history and evolution

In 39 days (18 Aug to 25 Sep 2026) the project went from a Lovable-generated clinic PMS to a remediated, tested two-portal product: 93 commits by two main contributors (54 and 38) plus one design-branch commit, delivered as a 12-phase security remediation programme followed by three client feedback workstreams.

### 10.1 Branches

| Branch | Tip | Relation | Contents |
| --- | --- | --- | --- |
| `e2e` (checked out) | `b2e554e` | 40 ahead of `main`; tracks `origin/e2e` (in sync at `b2e554e`) | Everything below from 13 Sep onward, including the 26 Sep access-catalogue pull; confirmed pushed with `git ls-remote` |
| `main` = `origin/main` | `3b05aa7` | Base | Phases 0–9 foundations up to 13 Sep |
| `patient0` / `origin/patient0` | `3c7aa71` local / `541a8d6` on GitHub | Behind `e2e`; the remote has moved since the last fetch (local `origin/patient0` still reads `baa584b`) | Patient portal specs, wireframes, clinic upgrade, insights |

Working tree: one modified plan file and untracked `.cursor/feedback/` (the client feedback PDF) and three plan files for the feedback workstreams.

### 10.2 Timeline (newest first)

| Date | Commits | Milestone |
| --- | --- | --- |
| 25 Sep (pulled 26 Sep) | `98ec3d9` … `b2e554e` (6) | **Access catalogue**: 41 visibility keys, /access editor, software-developer admin role, per-page redirects; login autofill; offer pictures (see §1.1) |
| 24–25 Sep | `08534f3`, `e5ce9e3`, `91d04c4`, `dc9539d` | Period picker custom ranges; consent handling (signed form required before Waiting); treatment workflow and photo management polish; patient record and feedback refinements |
| 24 Sep | `85d202a` | **Offers and marketing** (Workstream 3): stage offers, templates, AI drafts, automation, sends, portal claim |
| 24 Sep | `ecccbb6`, `4d44fe9` | **Treatment workflow** (Workstream 2): arrival to complete, three-page form; portal records gallery |
| 24 Sep | `92cb3ef` | **Feedback corrections** (Workstream 1): \~25 fixes across both portals, appointment confirmation |
| 22 Sep | `5ae7d4e`, `3c7aa71`, `bb2b7b9`, `24005d1` | V4 wireframes; **patient portal integrated**: schema, portal server functions, AI care assistant, demo fixtures, V4 UI |
| 20 Sep | `baa584b` | **Insights**: pipeline, book quality, day-to-year reporting, website ingest |
| 19 Sep | `c29890d`, `697d6ef`, `5d5dbae` | Performance/retention/earnings rebuild, profile security tabs; 18 tsc regressions fixed after the pull |
| 18 Sep | `49fd8a3` … `873e8dd` (7) | Two-bubble floating dock; diary day/week/month unified; **voice call + AI patient responder** |
| 17 Sep | 9fe6e08, `7b411eb`, `092b33f` | **Clinic portal v3 upgrade**: journeys (treatment plans), avatars, dashboard, patient tabs, retention insights |
| 15 Sep | `b88451e` … `6230ea4` (8) | Patient portal v2/v3 designs; **regression suite** (Vitest + Playwright); consent magic links; real bookings, deposits, recall, invites; reminders and unsubscribe (Phase 9) |
| 13 Sep | `9aaa878` … `3b05aa7` (9, from 12 Sep) | Patient portal spec/wireframes (v0.4); MFA gate fixes; 15-min idle timeout (Phase 6) |
| 10 Sep | `f992570`, `fcc46e0` | **Phases 6–8** landed together: auth hardening, comms outbox, Resend/Twilio adapters |
| 26 Aug | `0112cba` … `0e383a8` (9) | **Phase 5 database hardening**: grants, unique patient identity, signed immutability, retention, indexes, clinic isolation |
| 24 Aug | `09bbe7d`, `f2be58c`, `3f77a28`, `9ddc507` | **Phases 2–4**: open handlers closed, declarative POLICY with build check, zod on every payload |
| 23 Aug | `0176d4b` … `f3a2190` (8) | **Phases 0–1**: honest copy, audit refresh, WORKLOG convention, Node 22 pin, guards extracted, failure surfacing |
| 22–23 Aug | `df4c94f`, `ad15779` … `c443aac` (14) | Codebase quality audit (47 findings, 8 critical); staff chat, inbox, recall task and toolbar work |
| 18–21 Aug | `37e17a4` … `a97236f` (7) | Initial clinic PMS with the Aetheria glass theme; Supabase integration; Tiptap; appointment handling |

Before the first commit, Lovable plans dated 11–12 Aug (`.lovable/plan/`) record the original build: patient records platform, earnings, messaging, retention, diary redesign, dashboard.

### 10.3 Remediation programme status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Audit refresh, honest copy | Complete |
| 1 | Authorization foundation (guards, identity cache) | Complete |
| 2 | Guard retrofit (22 open handlers + `sendMessage`, `signDocument`) | Complete |
| 3 | Capability RBAC, POLICY map, build check | Complete |
| 4 | Runtime validation (zod) | Complete |
| 5 | Database hardening | Complete |
| 6 | Identity and authentication | In progress (SMTP, TOTP, SAML, closing public signup open) |
| 7 | Comms schema and outbox | Complete |
| 8 | Provider adapters | Complete (no live send yet) |
| 9 | Wire comms to real flows | Complete |
| 10 | Patient portal and onboarding | Pending (portal UI now built via the feedback workstreams; invitations and patient storage policy remain) |
| 11 | Architecture and tests (split god-modules, typed `Ctx`, live auth tests) | Pending |
| 12 | UX, mobile, accessibility | Pending |

Working method: every phase has a micro-plan in `docs/plans/` written before the work and never edited after; `docs/WORKLOG.md` records what changed, how it was verified, what was deferred and residual risk. The feedback workstreams follow the same pattern with their own work logs.

## 11. Known gaps, risks and tech debt

The biggest structural risk is unchanged since the August audit: authorization and tenancy hold only because every handler goes through `authorize()` and the `clinicScoped` proxy, since the service-role client bypasses RLS; the biggest delivery risk is that no real email or SMS has ever left the system.

### 11.1 Risk register

| Area | Issue | Impact | Source |
| --- | --- | --- | --- |
| Security | Service-role client for all app traffic (ES256 JWTs rejected by PostgREST); RLS is defence-in-depth only | A handler that skips `authorize` or a query that bypasses the proxy is open | Audit §4.1, every work log |
| Security | Demo layer never loads guards; looser than production on team-admin handlers | Demo is not evidence of production authorization | Phase 1 log |
| Security | `sanitizeNoteHtml` is a regex, not DOMPurify; `saveMyNote` re-parses HTML in Tiptap | Self-XSS on private notes | Phase 4 log |
| Security | `listRecallTasks` readable by any staff for any patient; `deleteMessageTemplate` owner-gated but not scoped by author | In-staff over-read / over-delete | Phase 2–3 logs (still present) |
| Auth | Public signup open; Supabase Auth SMTP not configured; email MFA inactive without Resend; no TOTP or SAML | Owner/manager MFA not enforced until Resend is set up | Phase 6 (in progress) |
| Tenancy | `handle_new_user` picks the oldest clinic (`ORDER BY created_at LIMIT 1`) | A second real tenant would get new users in the wrong clinic | Phase 5 log |
| Data | `erase_patient` is irreversible (guarded by legal hold, 8-year window, audit) | Permanent loss of a medical record on misuse | Phase 5 log |
| Comms | No live Resend/Twilio send, bounce or webhook proven; `pg_cron` drain not scheduled; SPF/DKIM/DMARC and UK sender ID pending | Reminders, consent links and offers do not leave the building in production | Phases 8–9 logs |
| Comms | Reminders queue at booking time and do not reflow when `reminder_offsets` change; sandbox "sent" reads like delivery | Stale reminder times; staff misread demo status | Phase 9 log |
| Roles | Front desk seeded with `treatments.record`; retention vs task scoping rules disagree | Receptionists can write clinical notes by default | Phase 3 log |
| Bug | `updateStaffMember` saves profile edits before the self-demotion check throws | Partial write on a refused action | Phase 3 log |
| Bug | `submitProfileChange` has no UI entry point, so the approval queue on `/team` can never fill | Dead feature | Phase 1 log (still true) |
| Tests | `reminders.spec.ts` failing; no live-Supabase tests for auth, RLS or triggers | Reminder regressions and live-only bugs go unseen | §9 |
| Ops | 16 migrations since 15 Sep (including the admin, access-catalogue and offer-image ones) need confirming against the live ledger; `e2e` is confirmed pushed (origin/e2e at b2e554e) | Live schema may lag the code | §7.5, §10.1 |
| Security (new) | The admin role passes every can() check, counts as a manager and may call setRolePermission; scripts/provision-staff.mjs creates developer@aetheria.clinic with a default password committed to the repo | Running the script against live creates a clinic-wide superuser with a known password | b17ba12, 98ec3d9 |
| Access (new) | getDashboard, getMyProfile, getMyEarnings and the staff side of getPatient now need view.\* grants, which exist only where the 27 Sep migration seeded them (existing clinics at apply time) | Until the migration is applied live, or for any clinic created later, non-owner staff lose the dashboard and patient records | 20260927000100\_access\_catalogue.sql |
| Access (new) | 33 of the 41 view keys are enforced in the UI only; for example hiding the Documents tab does not stop getPatient returning documents | Visibility is a presentation rule, not a data boundary | policy.ts vs access-catalogue.ts |

### 11.2 Tech debt

- **God modules:** `clinic.functions.ts` 8,165 lines, demo twin 5,953, `schedule.tsx` 2,607, `patients.$id.tsx` 1,354, `today-snapshot.tsx` 1,255, `treatment-form-dialog.tsx` 1,024. Phase 11 plans to split them by domain.
- **Duplication:** every handler exists twice (prod + demo); parity is enforced for names and schemas, not behaviour.
- **Types:** `Ctx.supabase` is `any`; `types.ts` is regenerated then hand-edited for new tables, so a blind regeneration can drop columns; `tsc` reports \~50–60 errors under `exactOptionalPropertyTypes`.
- **Lint:** \~2,900 findings (Prettier drift, `no-explicit-any`), non-blocking in CI.
- **Frontend resilience:** many routes lack query error UI (audit §7.3); inline validation exists on a handful of forms only (booking dialogs excluded).
- **Missing UI:** no archived-patients view, no staff authoring UI for clinic news, clinic offers or skincare routines (seeded via SQL), no patient-side payments.
- **Mobile and accessibility (Phase 12):** no mobile drawer navigation, no skip links, few `aria-live` regions, unlabelled toggles, contrast unverified.
- **Repo hygiene:** a 129 MB `.git`; `docs/patient-portal/files/patient0.bundle` and `files.zip` are tracked binaries.

### 11.3 Open questions

- Should the platform move off the service-role client (per-request user client once the ES256/PostgREST issue is solved) so RLS becomes the enforcing layer?
- Is multi-clinic tenancy a near-term requirement? If so, `handle_new_user`, invites and the one-clinic-per-person assumption need work first.
- Which provider accounts, sending domain and UK sender ID will production use, and who owns the `pg_cron` schedule?
- Should front desk keep `treatments.record`, and which scoping rule (practitioner book vs assignments) is the product rule?
- Who should hold the `admin` role on the live project, and should visibility editing stay a developer tool at `/access` or move to the owner?
- Should the eight server-enforced view keys grow to cover the data behind each hidden tab, or is visibility meant to stay presentation-only?

## 12. Appendix

### 12.1 Full route map

| Path | Surface | Access |
| --- | --- | --- |
| `/` | Marketing landing (staff sign-in and patient portal split) | Public |
| `/auth`, `/auth/reset`, `/auth/callback` | Staff sign-in, password reset, OAuth callback | Public |
| `/portal` | Patient sign-in (`?next=` supported) | Public |
| `/d/$token` | Consent document signing via magic link | Token |
| `/u/$token` | One-click unsubscribe (POST to apply) | Token |
| `/dashboard`, `/schedule`, `/patients`, `/patients/$id` | Clinic floor | Staff |
| `/insights`, `/retention`, `/performance` | Reports | Capability |
| `/earnings` | Own commission | Non-manager practitioners |
| `/team`, `/team/$id` | Team and staff profiles | `team.view` |
| `/offers` | Offer templates | `offers.manage` |
| `/settings`, `/profile` | Clinic settings, own profile | Staff (edit by capability) |
| `/my-record` + `/plan`, `/plan/timeline`, `/plan/journal`, `/plan/routine`, `/clinic`, `/records`, `/appointments`, `/billing`, `/settings`, `/resources` | Patient portal | Patient (self) |
| `/access` | Visibility catalogue editor (added 26 Sep) | Admin role only (not the owner) |

### 12.2 HTTP API routes

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/comms/drain` | `Bearer COMMS_DRAIN_SECRET` | Drain due outbox rows across all clinics; runs offer automation first |
| `POST /api/comms/webhooks/resend` | Svix HMAC | Email delivery / bounce / complaint status |
| `POST /api/comms/webhooks/twilio` | Twilio SHA1 signature | SMS delivery status |
| `POST /api/comms/unsubscribe/$token` | HMAC token | Apply unsubscribe |
| `GET` / `POST /api/documents/access/$token` | Document access token | Read / sign a consent document |
| `POST /api/insights/events` | Per-clinic bearer ingest key (SHA-256 stored) | Website leads and product sales ingest |

### 12.3 npm scripts and tooling

| Command | Purpose |
| --- | --- |
| `npm run dev` / `dev:demo` | Live on 8080 / fixture demo |
| `npm run build` / `preview` | Production build (Nitro, Cloudflare) |
| `npm run check:policy` / `check:validators` / `check:tenancy` | Static authorization, validation and tenancy gates |
| `npm run test:unit` / `test:e2e` / `verify` | Vitest / Playwright / everything |
| `node scripts/provision-remote.mjs` | Create buckets and the first owner (needs service role) |
| `node scripts/ensure-owner.mjs`, `provision-staff.mjs` | Owner and staff accounts; provision-staff includes the admin account and accepts ONLY=\<email> to create one account |
| `node scripts/apply-migrations.mjs [--only]` | Ledger-aware SQL apply via `DATABASE_URL` |
| `node scripts/db-snapshot.mjs` | Diffable dump of grants, policies, triggers, indexes, row counts, ledger |

### 12.4 Key constants

Staff idle timeout 15 min · step-up validity 5 min · email OTP expiry 10 min, resend gap 30 s, MFA session 12 h · login lockout 5 failures in 15 min for 15 min · outbox max 8 attempts, claim 20 rows, stale `sending` 5 min, backoff cap 1 h · consent link expiry 14 days · reminders 168 h and 24 h before · ex-team archive 90 days · patient retention 8 years from last treatment · retention risk: lapsing 90–180 days, lost > 180 days.

### 12.5 Glossary

| Term | Meaning |
| --- | --- |
| Visit stage | Operational state of one appointment on the day (booked → complete, or no show), separate from `appointments.status` |
| Treatment plan / journey | Multi-session course with milestones, shown as the portal timeline and the staff journey board |
| Recall | Follow-up of a patient due or overdue for treatment; tasks in `recall_tasks`, contacts in `retention_outreach` |
| PECR | UK Privacy and Electronic Communications Regulations: marketing needs opt-in, reminders are opt-out, transactional always allowed |
| JCCP | Joint Council for Cosmetic Practitioners; the governance standard the history-review and staff-document features align to |
| Step-up | Re-entering a password before a destructive action |
| Sandbox | Comms mode that logs instead of calling providers (always on in demo) |
| Demo twin | The fixture-backed copy of every server function in `clinic.functions.demo.ts` |
| Capability | A `role_permissions` key such as `comms.send`; owners hold all |

### 12.6 Sources consulted

Read from the connected folder on 26 Sep 2026: `README.md`, `AGENTS.md`, `package.json`, `vite.config.ts`, `playwright.config.ts`, `.env.example` (keys only), CI workflow; `docs/AUDIT-2026-08-22.md`, `docs/WORKLOG.md`, `docs/plans/*`, `docs/clinic-portal/aetheria-clinic-portal-guide.md`, `docs/pull-summary-2026-09-19.md`, treatment-workflow and offers work logs, `.cursor/plans/*` (master plan, portal integration, feedback corrections), `.cursor/rules/*`; source in `src/lib/auth/*`, `src/lib/clinic.functions.ts`, `src/lib/comms/*`, `src/lib/visit-stage.ts`, `src/lib/retention.server.ts`, `src/lib/demo/data.ts`, routes and components; `src/integrations/supabase/types.ts`; all 70 migrations (headers, functions, triggers, policies); unit and e2e specs; screenshots (repo root, clinic-portal guide, V4 live comparisons); `git log` and branches. The live Supabase database could not be reached from this session. Update of 26 Sep: git reflog and diff for the pull dc9539d → b2e554e (all six commits, the three migrations, access-catalogue.ts, policy.ts, guards.server.ts, permissions.ts, route.tsx, app-shell.tsx, team.index.tsx, offers files) and docs/rbac/access-catalogue.md; check:policy, check:validators and check:tenancy re-run and passing. Unit and e2e suites were not re-run (the installed node\_modules are macOS builds).
