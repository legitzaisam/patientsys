---
name: Codebase audit report
overview: Produce a single granular Markdown audit report covering security, backend, database, frontend architecture, SOLID adherence, UI/UX flows, accessibility and compliance — grounded in four completed deep-dive analyses, then verified against the live Supabase project and a runtime walkthrough.
todos:
  - id: live-verify
    content: "Read-only verification against live Supabase project aljozsxrdqfxiqczhbqn: applied migrations vs files, live RLS policy dump, live index list, patients.user_id uniqueness, messages UPDATE policy gap"
    status: completed
  - id: runtime-walk
    content: Reinstall Playwright (--no-save) and capture per-role journey screenshots in demo mode, including the mobile viewport, into docs/audit-screenshots/flows/
    status: completed
  - id: write-security
    content: "Write the security and authorization section: RLS-bypass model, per-handler authorization matrix, PHI exposure, impersonation, privilege escalation"
    status: completed
  - id: write-data
    content: "Write the database section: clinic isolation, cascade deletes, consent mutability, audit tamper-evidence, constraints, indexes, migration hygiene"
    status: completed
  - id: write-code
    content: Write the backend and frontend code-quality sections including SOLID analysis, god-modules, live/demo divergence, duplication, type safety
    status: completed
  - id: write-ux
    content: Write the UI/UX, flows, accessibility and performance sections with embedded screenshots and per-role journey maps
    status: completed
  - id: assemble
    content: Assemble docs/AUDIT-2026-08-22.md with executive summary, severity dashboard, architecture diagram, prioritised remediation backlog and appendices
    status: completed
isProject: false
---

# Codebase audit report

## Deliverable

One file: `docs/AUDIT-2026-08-22.md`, with supporting screenshots in `docs/audit-screenshots/flows/`. Report only — no source changes. The existing [docs/AUDIT-2026-08-20.md](docs/AUDIT-2026-08-20.md) is a change log for one batch of work and stays untouched; this is a separate quality audit.

## Research already done

Four parallel deep-dives are complete, covering backend server functions, database and RLS, frontend architecture, and UX/accessibility. Findings below are already evidenced with file:line references. The remaining work is live verification plus writing it up.

## The finding that frames the report

[src/integrations/supabase/auth-middleware.ts](src/integrations/supabase/auth-middleware.ts) verifies the user's JWT and then queries with the **service-role key, which bypasses RLS**:

```
// server functions verify the user JWT via Auth, then query the database
// with the service-role key. RLS is not applied on that client — handlers
// must keep using context.userId.
```

Only `requireSupabaseAuth` is applied globally. About 35 of 75 handlers never call `loadIdentity`, `requirePermission` or `requireOwner`, so authorization for those is effectively client-side only. Concrete consequences found:

- `listPatients` ([clinic.functions.ts:397](src/lib/clinic.functions.ts)) and `getPatient` (443) return full PHI with no staff or ownership check.
- `sendMessage` (961) takes `as: "staff" | "patient"` from the client, so a patient can author staff messages.
- `signDocument` (1382) updates by ID with no ownership check — any user can sign any consent document.
- `listStaffNotifications` (1047) omits `.eq("recipient_id", ...)`, returning clinic-wide notifications; the demo implementation gets this right, so production is stricter nowhere and looser here.

## Live verification (now unblocked by the updated .env)

Read-only introspection against project `aljozsxrdqfxiqczhbqn`, no writes:

1. Confirm which migrations actually applied, and whether the rewritten baseline `20260811000643_*.sql` left the live schema drifted from the file.
2. Dump live RLS policies and compare against the migration files; confirm the missing `messages` UPDATE policy that would break `markMessagesRead`.
3. List live indexes and confirm the missing ones identified against real query patterns.
4. Confirm `patients.user_id` has no UNIQUE constraint, which makes `current_patient_id()` non-deterministic.

## Runtime walkthrough

Reinstall Playwright (`npm i playwright --no-save`; it was pruned by the last `npm install`), then capture the per-role journeys in demo mode for the UX section: sign-in, dashboard, diary, patients, patient record, retention, team, settings, plus the mobile viewport that has no sidebar drawer. Screenshots embedded inline in the report.

## Report structure

1. **Executive summary** — severity dashboard, the five things to fix first.
2. **Scope and method** — what was analysed statically, what was verified live, what was not verified and why.
3. **Architecture overview** — request path from route to server function to Supabase, with a mermaid diagram showing where authorization is meant to happen versus where it does.
4. **Security and authorization** — the RLS-bypass model, per-handler authorization matrix, PHI exposure, impersonation, privilege escalation.
5. **Database and data integrity** — clinic isolation, cascade deletes destroying medical records, consent mutability, audit log tamper-evidence, missing constraints and indexes, migration hygiene.
6. **Backend code quality and SOLID** — the 2,856-line god-module, the live/demo duplication with its behavioural divergences, error swallowing, zero runtime validation across 54 pass-through validators.
7. **Frontend architecture and SOLID** — god-components (schedule.tsx at 2,205 lines), duplicated chips and booking forms, 17 `useIdentity()` call sites each opening a realtime channel, zero routes handling query errors.
8. **UI/UX and flows** — per-role journeys, navigation and IA, entry flows including the missing password reset and the dead-end signup, empty and error states, forms.
9. **Accessibility** — keyboard, focus, labels, contrast risk on the glass theme, colour-only status meaning.
10. **Performance** — polling stack, no virtualisation, re-render hot spots.
11. **Compliance posture** — GDPR erasure versus medical-record retention, consent defensibility, audit trail integrity. Flagged as engineering observations, not legal advice.
12. **Prioritised remediation backlog** — severity, effort, blast radius, ordered so fixes do not conflict.
13. **Appendices** — metrics, dead code inventory, full route and permission matrix.

Every finding carries a file:line reference, a short excerpt, the concrete impact, and a suggested direction. Severity is assigned on exploitability and clinical/legal consequence, not code aesthetics.

## Explicit non-goals

No code changes. No writes to the live database. No dependency upgrades. Compliance commentary is an engineering view, not legal sign-off.