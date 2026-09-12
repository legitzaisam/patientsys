---
name: Phase 8 provider adapters
overview: "Add Resend and Twilio adapters, a secret-protected drain with claim/backoff, delivery webhooks, and sandbox dispatch so demo never leaves the building."
todos:
  - id: p8-plan
    content: Write docs/plans/phase-08-provider-adapters.md from the live outbox
    status: completed
  - id: p8-adapters
    content: Email/SMS adapters + dispatch.server.ts with sandbox and backoff
    status: completed
  - id: p8-drain
    content: Claim RPC, /api/comms/drain, staff drainCommunications, webhooks
    status: completed
  - id: p8-ui
    content: Process queue on the outbox card; demo sandbox send
    status: completed
  - id: p8-verify
    content: Policy/tenancy/tsc green; drain 401 without secret; demo Process queue
    status: completed
isProject: false
---

See [docs/plans/phase-08-provider-adapters.md](../../docs/plans/phase-08-provider-adapters.md).
