# Phase 10: tests, full verification, after-captures, docs

Branch `e2e_live`, on top of `3223e3a`. 28–29 Sep 2026. Not pushed.

### p10-01-e2e-new

- `e2e/profile-redesign.spec.ts` (new, 9 tests, all green on the demo server):
  - practitioner self — hero (name, meta with the NMC number, registration / insurance / documents chips, both actions), five tabs with Security and no Access, Overview cards (no Commission tile, registration and insurance blocks, month share, four week rows, documents count, five bookable chips); qualification chip add → "Saved" → remove, and the documents chip landing on the Documents tab with Upload rows and the add-other well; "I've renewed" → date → sent for approval; earnings tab — month note, share and treatments, bars and rows, By treatment / By month headers, previous month "Invoice sent · paid", CSV download name, invoice dialog for the sent month (download only) then the current month (progress note, `INV-NR-YYYY-MM`, schedule → "Scheduled for"); schedule — seven pattern rows, "39 hours", three bank holidays, request Mon–Wed of the week after next through the sheet (hint flips, working-day count, note), pending row appears, withdraw removes it; a colleague's page is the Front desk layout.
  - owner on Nadia — manage layout, Commission 45 %, Access level, Access tab, no Security, "Add time off"; bookable editor toggles and saves; pattern edit (Tuesday 10:00–14:00) saves; a pending request is approved; the earnings tab opens without the invoice button.
  - manager on Nadia — Me layout with commission while `Edit staff profiles for Manager` is on; the owner switches it off on Team → Staff access → the manager gets the Front desk layout and no commission; switched back on.
  - front desk on Nadia — Front desk layout: Prescriber and compliance chips, the pattern line, Unavailable rows, bookable chips, none of "NMC 18C4471E", "Cosmetic Insure" or "Commission" in the page, and "Book with Nadia" opens the quick-add card.
- Dates are computed from the real clock (the demo fixture is relative to it): the request picks the Monday of the week after next and steps the sheet's picker to that month.

### p10-02-e2e-updates

- `e2e/feedback-corrections.spec.ts` — `:236` asserts the Overview's registration / insurance blocks, the arrangement tile, the qualifications card and the selected Overview tab (`aria-selected`), then opens earnings, security and documents; `:272` (My earnings) opens `?tab=earnings` and checks "Your earnings", `earnings-rate` ("Your share at 45%"), collected, outstanding, Export CSV and the invoice button, still with no exact "Earned" on the page — the table's money column reads "Share" for that reason.
- `e2e/profile-governance.spec.ts` — the owner's inbox assertion uses `.first()` (an earlier spec in the same run leaves an "Approved by Maya Chen" line in the inbox, which the strict locator tripped on).
- `e2e/team.spec.ts:12` — the member page now asserts the manage layout, the commission tile and "Their earnings" on the earnings tab.
- `e2e/metrics/rendered.spec.ts` — `earnings.*` promises come from `/api/demo/metrics?period=month` (the profile is one calendar month); `earnings.outstanding` and `earnings.month.share|treatments` added; the practitioner matrix gains `/profile?tab=earnings`; money renders to the penny while the snapshot promises whole pounds, so the comparison rounds the page value. `src/routes/api.demo.metrics.ts` accepts `period=month`.
- `e2e/responsive/pages.ts` — `profileTab` covers earnings / schedule / documents / security / access; `/profile` runs every tab plus the time-off sheet and the invoice dialog for the owner and the schedule and documents tabs for every staff role; `team-member` runs for owner, practitioner and front desk with the manage tabs for the owner; `earnings` points at `/profile?tab=earnings`.
- `e2e/changelog/commit-captures.spec.ts` and `e2e/review/feedback-captures.spec.ts` — settle selectors and tab ids follow the new page (`profile-tab-overview`, `registration-block`, `?tab=earnings`); a Schedule capture added to the changelog list.
- Permission unit tests needed no change (P3 verified them; the two keys are covered by `policy-scope.test.ts` and the guards).
- Hooks: every figure with a snapshot promise keeps `data-qc="metric:…"` (`earnings.share|collected|outstanding|treatments`, `earnings.month.share|treatments`); counts without one — documents on file, time-off totals, weekly hours, daily-bar value, table total, patients / new / attendance / retention tiles — are plain `data-qc` hooks so the "every hooked number has a promise" invariant holds.
- Tap-target findings from the responsive gate fixed: register link 24 px tall, sheet month-stepper buttons 32 px, each daily-earnings bar a full-height column in a strip that scrolls sideways under 900 px.
- Demo fixture: Nadia's pending job-title request now carries her current registration expiry — approving it (which `clinic-setup.spec` does earlier in a full run) used to clear the expiry and drop the hero chip.

### p10-03-full-verify

| Check | Result | Baseline (P0) |
| ----- | ------ | ------------- |
| `check:policy` | ok — 182 handlers | 170 |
| `check:validators` | the two pre-existing `saveAppointment` problems only | same |
| `check:tenancy` | ok — 58 tables (49 scoped) | 54 |
| `check:metrics` | 16 / 17, the pre-existing `insights-recalc.audit` mismatch | same |
| Unit (`vitest`) | 198 passed, 11 failed — the same 11 (policy-scope 1, earnings 1, insights 4, period-picker 5) | 178 + 11 |
| Chromium e2e (full) | 171 passed, 1 did not run, 9 failed: the P0 six (`feedback-corrections:61`, `:209`, `:257` (was `:261`), `patients:246`, `reminders:10`, `treatment-workflow:134` (was `:60`)) plus `team-chat-dock:100` — confirmed failing on the P0 commit `786cf13` in a worktree, so pre-existing and clock-dependent — `team.spec:28` (the Last-active day-boundary flake) and `patient-portal/sync.spec:101` (toast timing; green in a smaller run). Every profile spec passes: `profile-redesign` 9/9, `profile-governance` 3/3, the updated `team` and `feedback-corrections` tests | 162 + 6 |
| `test:metrics` (Playwright, pinned clock) | 16 / 19 — the three `/dashboard` mismatches (`treatmentsDueSoon` 42 vs 40, `treatmentsOverdue` 110 vs 112) also fail on `786cf13`, so pre-existing; all five practitioner pages including `/profile` and `/profile?tab=earnings` pass | not run at P0 |
| Responsive gate, `RESPONSIVE_GATE=major`, all 7 devices | 441 / 441 (`test-results-responsive/playwright.json`: expected 441, unexpected 0, flaky 0) | — |
| tsc | 109 errors, 0 new against the 116-error baseline (the retired route code carried seven) | 116 |
| Lint | `new-by-line 0` on all 56 touched files (`e2e/**`, `src/**`, `tests/**`); `staff-files.tsx` 25 → 12, `team.$id.tsx` 355 → 0, `profile.tsx` 18 → 0 | — |

### p10-04-after-captures

- `captures/after/` — the 21 P0 scenes re-taken with the same script and names (1440 px, full page). Side-by-side table in the README. A coarse block diff over each pair: untouched pages 0.2–2.8 % of blocks changed (sidebar logo, clock-driven text), diary and patients ~21–24 % (rows of dates; the diary's Now / Next strip appears in clinic hours and the P0 shot was out of hours), the eight profile / team-member scenes 9–29 % (the redesign). No source file outside the plan's scope changed between `c291ab1` and `HEAD` (`git diff --stat` filtered to the plan's paths leaves nothing).

### p10-05-docs-commit

- `docs/profile-redesign/README.md` — phase table with commit hashes, all 60 to-dos `done` with their worklog anchors, the Regression proof table.
- Root `README.md` › Roles — the two manager-only keys, what each unlocks, and that the owner switches them under Team → Staff access.
- Worklogs 06–09 carry a "Revised in P10" note for the hook renames, the Share column, the month window and the tap-target fixes.
- Committed on `e2e_live`; not pushed.

## Phase summary

Ten commits (`786cf13` … this one) on top of `c291ab1`. The staff profile is the mockup's layout in the app's theme, routed by role: Me for yourself; Me for the owner, the software admin and a manager holding Edit staff profiles (commission and earnings only with Set staff commission); Front desk for everyone else. Working patterns, time off, bookable treatments and practitioner invoices are real (schema, server functions, demo fixtures). The mark and wordmark are SQINOS everywhere `BrandMark` renders, including the patient portal's sidebar and sign-in.

Open items for a follow-up, none of which this plan touched by design: the diary does not yet read working patterns or time off; booking forms do not filter by bookable treatments; the Attention list does not list time-off or pattern requests (approvers use the staff notification bell); route `<title>` strings and the sign-in email copy still say "Aetheria".
