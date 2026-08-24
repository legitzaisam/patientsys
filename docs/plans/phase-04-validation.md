# Phase 4 — Runtime validation with zod

**Status:** Complete
**Depends on:** Phase 3 (capability-based RBAC)
**Work log:** [../WORKLOG.md](../WORKLOG.md)
**Audit:** §16 of [../AUDIT-2026-08-22.md](../AUDIT-2026-08-22.md)
**Rolls back with:** `git revert` of the Phase 4 commit. Nothing outside the repo changed — no migration, no data, no configuration.

## Decisions taken before starting

**Schemas are not passed to `.validator()` directly.** TanStack Start's `execValidator` detects Standard Schema, which zod 3.24 implements, and reports a failure as `JSON.stringify(issues, null, 2)`. About 52 call sites do `onError: (e) => toast.error(e.message)`, so the obvious wiring would have put a multi-line JSON blob in a toast. Every validator keeps its function form and calls `parseInput(Schema, data)`, which throws one readable sentence. This also preserves the declared input type at each call site, avoiding type churn across 62 handlers.

**Strictness: mirror today's shapes, harden only where it is safe.** Enums, number ranges, max lengths, trim, non-empty on required fields. No format assertions. The concrete reason is that demo fixture ids are `6-4-4-4-12`, so `.uuid()` would have broken demo mode immediately, and date fields mix `YYYY-MM-DD` with full ISO, so `.datetime()` would have broken `date_of_birth`. Emails reuse the existing `checkEmail` rather than `z.string().email()`, keeping one definition across client and server.

**Client scope: four pilot forms, not all of them.** Server enforcement covers everything; inline errors are net-new work per form. Four surfaces prove the pattern.

## What planning found

**Demo parity is free here, unlike Phase 1.** The Vite plugin only rewrites `src/lib/clinic.functions.ts`, so a new `src/lib/validation/` module is never swapped. Both files import the same schemas. Phase 1 had to accept production-only guards; this phase has no drift.

**The master plan's XSS premise was wrong.** `saveAppointmentNote` does skip the sanitiser, but appointment notes render as escaped React text everywhere, and the only `dangerouslySetInnerHTML` in `src/` is static chart CSS. The sanitiser was added as defence-in-depth and the audit records a correction rather than claiming a fix. Flagged before any code was written, not discovered afterwards.

## Tasks

| # | Task | Verification |
|---|---|---|
| 0 | `validation/primitives.ts` and `validation/parse.ts` with `parseInput()` | Errors read as sentences, not JSON |
| 1 | 62 schemas in `validation/schemas.ts` | `check:validators` field-for-field against declared types |
| 2 | Wire 62 validators in `clinic.functions.ts` | No `=> data` pass-throughs left |
| 3 | Wire the matching 62 in `clinic.functions.demo.ts` | Prod and demo name the same schema per handler |
| 4 | `sanitizeNoteHtml` on `saveAppointmentNote`, both sides | `rg` shows it on both note paths |
| 5 | `scripts/check-validators.mjs`, wired to `npm run check:validators` | Negative-tested: fails when a schema is unwired |
| 6 | Four pilot forms on `useForm` + `zodResolver` | 10/10 inline-error and valid-submit checks |
| 7 | Verify | See work log |
| 8 | Docs, then one commit | — |

## Out of scope

`quick-add-appointment` and the `schedule.tsx` booking dialog — both branch into an inline new-patient path spanning two schemas and are the highest-regression forms in the app. Inline validation for every other form. Replacing `sanitizeNoteHtml` with DOMPurify. Removing the inert `as` field from `sendMessage`, which means touching its callers. Any change to what a handler accepts beyond rejecting what its declared type already forbade.
