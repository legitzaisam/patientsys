---
name: Phase 7 comms outbox
overview: "Add the communications outbox and patient PECR preferences, enqueueCommunication as the single write path, and rename recall task status sent → open so 'sent' stops meaning 'task created'."
todos:
  - id: p7-plan
    content: Write docs/plans/phase-07-comms-outbox.md from the live comms surface
    status: completed
  - id: p7-schema
    content: Migration for communications, patient prefs, recall sent→open, types + tenancy
    status: completed
  - id: p7-enqueue
    content: Consent rules, enqueue helper, three handlers + demo twins
    status: completed
  - id: p7-ui
    content: Prefs and outbox on patient record + portal; recall labels say Open
    status: completed
  - id: p7-verify
    content: Policy/validators/tenancy/tsc green; demo prefs, log, and recall labels
    status: completed
isProject: false
---

See [docs/plans/phase-07-comms-outbox.md](../../docs/plans/phase-07-comms-outbox.md).
