---
name: VoIP calls + AI patient
overview: Add a real Twilio browser call button to the floating chat window that dials one of a small pool of your verified demo numbers per patient, and a demo-mode AI auto-responder (Cohere Command A+) that texts back as the patient, with a canned fallback when no API key is set. Built in dependency order — foundations, then the self-contained AI responder, then the voice server layer, then the voice UI, then QC — with a work log filled in for every phase.
todos:
  - id: p0-deps
    content: "Phase 0: Install deps — twilio (server AccessToken) and @twilio/voice-sdk (browser); verify tsc baseline unchanged"
    status: completed
  - id: p0-env
    content: "Phase 0: Add TWILIO_ACCOUNT_SID/API_KEY_SID/API_KEY_SECRET/TWIML_APP_SID/DEMO_NUMBERS + COHERE_API_KEY/COHERE_MODEL to .env.example"
    status: completed
  - id: p0-docs
    content: "Phase 0: docs/voice-call-setup.md — Twilio console walkthrough: API key, TwiML Bin dial template, TwiML App, verifying the 3 demo numbers, trial caveats"
    status: completed
  - id: a1-cohere
    content: "Phase A: src/lib/demo/patient-ai.server.ts — Cohere v2/chat client (command-a-plus-05-2026, COHERE_MODEL override), fixture persona prompt, SMS-style constraints, canned fallback on missing key/error"
    status: completed
  - id: a2-sendhook
    content: "Phase A: demo sendMessage hook — schedule one AI reply 4-8s after a staff message, per-patient pending registry so rapid sends collapse into one reply to the latest context"
    status: completed
  - id: a3-typing
    content: "Phase A: demo getPatientMessages returns typing flag while a reply is pending (schema/validator untouched — response-side only)"
    status: completed
  - id: a4-thread-ui
    content: "Phase A: ThreadView typing bubble + fast poll (~4s for 30s) after sending so the AI reply lands visibly"
    status: completed
  - id: b1-voice-server
    content: "Phase B: src/lib/comms/voice.server.ts — env reads, availability check, AccessToken mint (VoiceGrant), deterministic patient-to-pool-number hash"
    status: completed
  - id: b2-voice-fns
    content: "Phase B: getVoiceCallConfig / getVoiceCallToken / getVoiceCallTarget server fns + identical demo twins"
    status: completed
  - id: b3-policy-schemas
    content: "Phase B: POLICY staff entries + zod schemas for the three voice fns; check:policy and check:validators green"
    status: completed
  - id: c1-call-hook
    content: "Phase C: use-voice-call.ts — lazy @twilio/voice-sdk device, state machine (idle/connecting/ringing/connected/ended/error), timer, mute, hang up"
    status: completed
  - id: c2-call-ui
    content: "Phase C: Call button in chat thread header + call strip above the thread, logCallAttempt on connect, disabled state with tooltip when unconfigured"
    status: completed
  - id: d1-qc
    content: "Phase D: Playwright QC — unconfigured call state, fake-mic call strip flow, canned AI reply e2e with typing indicator, zero console errors"
    status: completed
  - id: d2-checks
    content: "Phase D: Fix QC findings; run check:policy/validators/tenancy + tsc delta + lints; fill all phase work logs"
    status: completed
  - id: d3-commit
    content: "Phase D: Commit to patient0 and push with Zaisam's token (URL push, keychain untouched)"
    status: in_progress
isProject: false
---

# VoIP call button + AI patient responder (demo)

```mermaid
flowchart LR
  subgraph chatwin [Floating chat window thread]
    callBtn[Call button in header] --> hook["useVoiceCall hook (@twilio/voice-sdk)"]
    composer[Composer sendMessage] --> demoFn[demo sendMessage twin]
  end
  hook -->|"getVoiceCallToken + getVoiceCallTarget"| serverFns[Server fns]
  serverFns -->|AccessToken| twilio[Twilio Voice]
  twilio -->|TwiML App webhook: TwiML Bin Dial| pool["Your 3 verified phones (patient hashed to one)"]
  demoFn -->|delayed reply| cohere["cohere.server.ts: v2/chat command-a-plus-05-2026"]
  cohere -->|no key / error| canned[Canned fallback replies]
  cohere --> messages[(demo messages fixture)]
  messages -->|poll + typing flag| chatwin
```

Phases run least-dependent first: Phase 0 (deps/env/docs, no code paths touched) → Phase A (AI responder, self-contained in demo fixtures, no Twilio dependency) → Phase B (voice server layer, depends only on Phase 0 env) → Phase C (voice UI, depends on B) → Phase D (QC over everything). Every phase ends with its work log filled in below.

## Phase 0 — foundations (no dependencies)

- Install `twilio` (server-side AccessToken minting) and `@twilio/voice-sdk` (browser device); confirm the tsc baseline is unchanged after install.
- Extend [.env.example](.env.example): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_DEMO_NUMBERS` (comma-separated E.164 pool you own), `COHERE_API_KEY`, `COHERE_MODEL` (default `command-a-plus-05-2026`).
- `docs/voice-call-setup.md`: one-time Twilio console walkthrough — create API key/secret, create a TwiML Bin containing `<Response><Dial callerId="YOUR_TRIAL_NUMBER"><Number>{{To}}</Number></Dial></Response>`, point a TwiML App's Voice URL at the Bin (no public webhook or ngrok needed), verify your ~3 demo numbers, and the trial caveats (calls arrive from the Twilio trial number with a preamble, 10-minute cap, verified same-country numbers only).

**To-dos:** `p0-deps`, `p0-env`, `p0-docs` · **Work log:** _(filled during implementation)_

## Phase A — AI patient responder (independent of Twilio)

- `src/lib/demo/patient-ai.server.ts`: POST `https://api.cohere.ai/v2/chat` with `COHERE_API_KEY`; model from `COHERE_MODEL`. System prompt builds a persona from demo fixtures (name, age, treatments, recent appointments) and constrains style: terse SMS, 1–2 sentences, no markdown. History maps staff→`user`, patient→`assistant` (the model speaks as the patient), last ~12 messages. Missing key, API error, or rate-limit → rotating canned replies so demos never stall (trial budget: 1,000 calls/month, 20/min).
- Demo `sendMessage` twin in [src/lib/clinic.functions.demo.ts](src/lib/clinic.functions.demo.ts): staff message → schedule exactly one reply after 4–8s; a per-patient pending registry collapses rapid follow-ups into a single reply against the latest thread. Patient-portal-authored messages never trigger replies.
- Demo `getPatientMessages` returns a `typing` flag while a reply is pending (response-side only; input schema untouched).
- `ThreadView` in [src/components/floating-dock/chat-bubble.tsx](src/components/floating-dock/chat-bubble.tsx): typing bubble while `typing` is set, and a faster poll (~4s for ~30s) after sending.

**To-dos:** `a1-cohere`, `a2-sendhook`, `a3-typing`, `a4-thread-ui` · **Work log:** _(filled during implementation)_

## Phase B — voice server layer (depends on Phase 0)

- `src/lib/comms/voice.server.ts` following the [config.server.ts](src/lib/comms/config.server.ts) pattern: env reads, `voiceAvailable()`, AccessToken minting with VoiceGrant (`TWILIO_TWIML_APP_SID`), and a deterministic patient-id hash into the `TWILIO_DEMO_NUMBERS` pool so every patient consistently rings the same of your ~3 phones (`{ phone, label: "Demo line N" }`).
- Three server fns in [src/lib/clinic.functions.ts](src/lib/clinic.functions.ts) + identical demo twins (telephony is real even in demo): `getVoiceCallConfig()` → `{ available }`; `getVoiceCallToken()` → `{ token, identity }`; `getVoiceCallTarget({ patient_id })`.
- `POLICY` staff entries + zod schemas; `check:policy` and `check:validators` stay green.

**To-dos:** `b1-voice-server`, `b2-voice-fns`, `b3-policy-schemas` · **Work log:** _(filled during implementation)_

## Phase C — voice UI (depends on Phase B)

- `src/components/floating-dock/use-voice-call.ts`: lazy-imports `@twilio/voice-sdk` on first call, mints token, `device.connect({ params: { To } })`; state machine idle → connecting → ringing → connected (mm:ss timer, mute toggle) → ended/error; cleans up the device on window close.
- [chat-bubble.tsx](src/components/floating-dock/chat-bubble.tsx): phone icon button in the thread header right of the patient name (next to dock/close); slim call strip above the thread showing state, target label ("Demo line 2"), timer, mute, hang up. Logs via existing `logCallAttempt` so calls land in the comms trail. Unconfigured env → disabled button with tooltip.

**To-dos:** `c1-call-hook`, `c2-call-ui` · **Work log:** _(filled during implementation)_

## Phase D — QC, checks, commit (depends on all)

- Playwright QC: without keys the call button shows its disabled/unconfigured state; with fake-mic launch flags the call strip appears and fails gracefully; sending a chat message produces a patient reply (canned fallback) preceded by the typing indicator; zero console/page errors. With your keys in `.env`: manual check that your phone rings and Cohere answers in character.
- Fix findings; run `check:policy` / `check:validators` / `check:tenancy`, tsc delta, lints; fill any remaining work logs.
- Commit to `patient0`, push with Zaisam's token (URL push, keychain untouched).

**To-dos:** `d1-qc`, `d2-checks`, `d3-commit` · **Work log:** _(filled during implementation)_

## Out of scope

AI answering the voice call itself (calls go to real humans), production-mode AI replies, patient-portal-side automation, and SMS delivery (chat stays in-app).
