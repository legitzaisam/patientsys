# Phase 1: wording, developer-note removal, confirmations, formatting

Branch `e2e_live`, on top of `a7e060b`. 27 Sep 2026.

## Scope

Index bullets 001, 005–011, 013, 016–020, 023 (text part), 026, 027, 050, 051, 052 (label), 060, 061, 062, 075–078, 088–090, 100, 101, 114, 116, 118, 120, 121, 127. All string, style or dialog work with no data dependency.

## Changes

### Developer notes (005, 061, 116)

- `src/components/security-settings.tsx`: the email-code hint no longer has a demo branch ("Demo keeps this on this device only"); one sentence for every mode.
- `src/components/comms/comms-preferences.tsx`: "Nothing is emailed or texted from here yet." removed from the staff copy.
- `src/components/comms/comms-log.tsx`: new `showDiagnostics` prop (default false). Without it the card reads "Everything sent to this patient, and anything still waiting to go", rows show `Text · appointment reminder · +44…` and `Sent 14 Sep 2026, 10:32`; with it (software admin) the subtitle, "Process queue", the provider ("sandbox"), the purpose and the attempt count appear. `patients.$id.tsx` passes `showDiagnostics={Boolean(identity.isAdmin)}`; the portal's `my-record.settings.tsx` never shows diagnostics.
- `src/components/retail-product-settings.tsx`: "No cart." dropped; the line reads "Physical products shown on the patient portal and counted in Insights."
- Integrations card (endpoint and ingest key): removed from `settings.tsx`, mounted under the software-admin `/access` page (`access.tsx`). `POLICY.getInsightsIngestKeyStatus` / `rotateInsightsIngestKey` move from `owner` to `accessAdmin` (owner or admin) and the demo twins check `isOwner || isAdmin`.

### Team subtitle (006, 120)

- `team.index.tsx`: "You're the clinic owner" for owners, "You hold manager access" for managers, nothing for others.

### Receptionist (007, 121)

- `demo/role-switcher.tsx` ("Receptionist"), `dashboard.tsx` heading ("Reception"), `invite-staff-dialog.tsx` baseline ("Reception work — …"), `staff-alert-dialog.tsx` (audience "Receptionists", per-person "Receptionist"), `notes/share-note-button.tsx` ("Receptionist"), two demo note bodies in `demo/data.ts`. The `front_desk` key is unchanged everywhere.

### Benchmarks (008)

- `patients/patient-metrics.tsx`: the four invented benchmarks ("clinics often 25–40%", "clinic median ~46%", "~69%", "aim near 30 / 70") replaced with plain definitions of each figure.

### Marketing sub-toggles (009)

- `comms-preferences.tsx`: "Marketing by email" and "Marketing by text" are disabled and dimmed (`opacity-60`) while Marketing is off, with the hint "Turn Marketing on first."

### Insights wording (075–078)

- `insights.tsx`: tab "Book" → "Patient base"; subtitle without "not a recall list"; "Needs a next step" description is one line ("New enquiries in this window who have not yet booked or had a first treatment."); What sold says "ranked by revenue". `funnel-tiles.tsx`, `funnel-chart.tsx`, `source-mix.tsx`: "Sign-ups" → "Online enquiries" and "signed up" → "enquiries". `access-catalogue.ts` and `permissions.ts` labels for `view.insights.book` follow (key unchanged).

### Retention and Performance wording (088–090, 100, 101)

- `retention/suggested-actions.tsx`: "These get more accurate as your clinic's data grows."
- `retention.tsx`: Revenue at risk hint explains the figure ("Lifetime spend of the at-risk patients whose last visit was …"). Action words: the at-risk table and the dashboard tasks both already say "Mark contacted" / "Contacted"; no change needed.
- `performance/performance-table.tsx`: "{name}'s extras" → "Details".
- `performance.tsx`: the "How to read this" paragraph is gone; an info icon (`src/components/info-hint.tsx`, Popover) sits beside the page title and beside "Practitioner KPIs". The definitions inside still describe today's money model; Phase 4 rewrites them.

### Profile and security wording (114, 116)

- `security-settings.tsx`: "We'll email you a code first to confirm it's you."; the session badge reads "This device" (not uppercase "CURRENT").
- `profile.tsx`: "Ask the clinic owner to change this." under the disabled work email.

### Record tab and card order (060, 062)

- "History updates" → "Medical history" in `patients.$id.tsx`, `access-catalogue.ts`, `permissions.ts` (key `view.patients.history` kept). Offers card moved above Contact preferences on the Contact tab.

### Dashboard wording (023 text, 026, 027)

- `today-snapshot.tsx`: "#3 · Fat Dissolving" → "Session 3 · Fat Dissolving" (plans already said "Session 3 of 6").
- `treatment-journeys.tsx`: plan name may wrap to two lines (`line-clamp-2`) instead of truncating.
- `app-shell.tsx`: the "Diary N" sidebar badge and its per-minute appointments query are removed (the badge plumbing on `NavLink` went with it).

### Formatting helpers (013, 016, 017)

- New `src/lib/format.ts`: `moneyWhole` (no pence at or above £1,000, no trailing .00 below), `dateTime` (date and HH:mm, never seconds), `daysAgoLabel` (today / yesterday / N days ago), `displayName(p, { surnameFirst, withTitle })`.
- `moneyWhole` on totals and KPIs: Performance totals and table (earned, collected, share, outstanding, clinic row), Performance trend tooltip, Retention revenue at risk, My earnings Earned / Collected / Outstanding, staff and my performance KPI cards, earnings table totals, Insights bestsellers revenue, at-risk lifetime value. `money()` (pence) stays on individual payments, prices, per-treatment averages and the earnings table lines.
- `dateTime` on the comms log rows and the record's Medical history timestamps; `daysAgoLabel` on the record header ("last seen today").
- Names: Patients table is surname-first without title ("Adeyemi, Grace"); the record header is natural order with title ("Miss Grace Adeyemi"); the Insights next-step lists are natural order. Four e2e h1 assertions updated from `/Bennett, .*Olivia/` to `/Olivia Bennett/` (`comms`, `offers`, `smoke`, `patients`); link assertions on the table are unchanged.

### Shared journey phases (050)

- New `src/lib/journey-phases.ts`; `patients/journey-board.tsx` and `dashboard/treatment-journeys.tsx` both read it. One label set (…, "Results & review") and one action-oriented subtitle per phase.

### Confirmations (019, 118, 127)

- New `src/components/confirm-dialog.tsx` on the existing `ui/alert-dialog.tsx` primitive (previously unused).
- Team: role change and Remove access (bin) confirm first (`team.index.tsx`, `data-qc="team-confirm"`); the step-up OTP still follows for removal.
- Offers: Archive template uses the dialog instead of `window.confirm` (`data-qc="offer-archive-confirm"`).
- Message templates: delete confirms (`message-composer.tsx`).
- Settings: archiving a treatment or a retail product confirms; restore stays one click.
- Patient Archive dialog copy now says it "starts the 8-year retention clock".

### Unsaved-changes guard (020)

- New `src/hooks/use-unsaved-changes.tsx`: TanStack `useBlocker` with `enableBeforeUnload`, rendering a "Leave without saving?" confirmation; `isDirtyForm` helper.
- Wired on My profile (`profile.tsx`, snapshot of saved values), the staff profile form (`team.$id.tsx`, react-hook-form `isDirty`), Clinic details (`clinic-details-settings.tsx`) and the offer editor (`offer-template-editor.tsx`: closing the sheet with edits asks "Discard your changes?"; a successful save closes directly).

### Shell polish (010, 011, 018)

- `styles.css` `.toolbar-icon-ring`: 1.5px butter outline on the four toolbar icon buttons (the chip surface forces border and box-shadow off, so this uses `outline`).
- Sidebar Team list scrolls inside a five-row box; with more than five members a "See all N on the Team page" link follows.
- Captions: dashboard Attention needed ("Today and this week: what to sort out before appointments happen. …"), Insights next step (new enquiries not yet converted), Retention at-risk ("Existing patients drifting away: …").

### Loading and error states (001)

- New `src/components/dashboard/load-state.tsx` (`LoadingCard`, `LoadError`). `KpiGrid`, `TodaySnapshot`, `AttentionList`, `TreatmentJourneys` take `status` and `onRetry`; `dashboard.tsx` derives the status from the dashboard and retention queries and shows placeholders until the first answer, or "Couldn't load … Retry" on failure. No "0" or "£0" is rendered while loading.

### List labels (051, 052)

- `patients.index.tsx`: DOB search placeholder "Date of birth"; the header checkbox is labelled "Select all N matching patients". The visible "Select all N matching" text and cross-page selection come with pagination in Phase 6.

## Verification

| Check                                                                            | Result                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                                                   | 103 errors, identical to baseline                                                                                                                                                              |
| ESLint (non-Prettier) on the 61 changed/new files                                | identical to baseline for the same files (196 `no-explicit-any`, 1 `prefer-const`, 7 `exhaustive-deps`); new files clean                                                                       |
| Unit                                                                             | 132/133, the pre-existing `policy-scope` failure only                                                                                                                                          |
| E2E: patients, comms, offers, team, smoke, rbac, retention, feedback-corrections | 62 passed, 3 failed: `feedback-corrections:57`, `:122`, `offers:84` — the pre-existing set                                                                                                     |
| Visual                                                                           | Performance (info popover, whole-pound totals, icon rings), Team subtitle, record header ("Miss Grace Adeyemi", "last seen today", "Medical history" tab), Insights, dashboard checked at 1440 |

E2E expectations changed and why:

- `e2e/comms.spec.ts`: the drain test runs as `admin` (the button is admin-only now); a new test checks clinic roles see no "Process queue", "sandbox" or attempt count.
- `e2e/offers.spec.ts`: switches to `admin` for the drain step and back to `owner`; `become()` accepts `admin`. `e2e/fixtures.ts` `DemoRole` gains `"admin"`.
- `e2e/patients.spec.ts`, `e2e/responsive/pages.ts`: "History updates" → "Medical history".
- Record h1 assertions → `/Olivia Bennett/` (four specs).

## Captures

Ad-hoc 1440 screenshots only (kept out of the repo); the review capture pack arrives in Phase 12.

## Notes

- Integrations (ingest key) is now a software-admin surface; owners no longer see it. Say if the owner should keep a read-only view.
- The Performance info text still describes the current money model; Phase 4 replaces it with Earned = Collected + Outstanding.
- The `policy-scope` unit test still asserts `archivePatient` is owner-only; Phase 2 changes both the policy and the test.
