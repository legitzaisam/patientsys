# Pull summary — 19 Sep 2026

Fast-forward on `patient0`: `873e8dd → 697d6ef`, two commits by legitzaisam
(co-authored with a Cursor agent), 52 files, +2,984/−647. Reviewed, health-
checked, and patched (18 TypeScript regressions fixed, see the end).

## Commits

- `c29890d` — Refactor styles and components for improved UI consistency
- `697d6ef` — Add patientId to earnings data structure and refactor earnings table

## What changed, by area

### Performance page
- New `staff-performance-kpis.tsx` (~300 lines) and `my-performance-kpis.tsx`:
  role-aware KPI grids with period-over-period change chips (money and count
  deltas, invertible for "lower is better" metrics).
- `performance-trends.tsx` gains a 1 month / 6 months / 1 year trend-view
  switcher (`TrendViewKey`), backed by `trendViewWindows()` and
  `moneyTotals`/`moneyChanges` helpers in `earnings.server.ts`, plus a new
  shared `charts/axis-tick.tsx` for consistent chart axes.
- `performance-table.tsx` restyled to match.

### Retention page
- `retention-trend.tsx` rebuilt around views (1m / 6m / 1y / 5y) including a
  weekly return-rate series for the 1-month view; `retention.server.ts` adds
  rolling-rate windows and week-keyed grouping.
- `at-risk-table.tsx` substantially reworked (~436 lines changed) with a wider
  scrollable table and clearer labels; `retention-breakdown.tsx` and
  `suggested-actions.tsx` restyled; `retention-insights.server.ts` extended.

### Earnings page
- `getMyEarnings` now returns `patientId` per line; the inline table was
  replaced by a new `earnings/earnings-lines-table.tsx` (~360 lines) with
  grouped rows, expand/collapse, and patient links.

### Profile and team member pages
- New `profile-account-tabs.tsx`: Security / Documents tabs on the profile.
- `security-settings.tsx` grew a full change-password flow: new server fns
  `sendPasswordEmailCode` (emails a 6-digit approval code, with an on-screen
  preview code in demo/dev) and `changeOwnPassword` (both `POLICY` kind
  "self", zod-validated).
- New `staff-record-tabs.tsx` shared by profile and `team.$id`;
  `staff-files.tsx` and `staff-doc-compliance.tsx` refreshed; new
  `staff-name.ts` (title + name splitting, shared title list).

### Chat / notes
- `visit-note-chip.tsx` reworked; new `plainVisitNote()` in
  `sanitize-note-html.ts` for text-only previews; appointment-note cache
  tweak.

### Global styling sweep
- Hover/selected states standardised on `rgba(47,63,102,…)` washes across the
  table primitive, dashboard cards, chat inbox rows, notification bell, role
  switcher, journey board and more; `styles.css` hover tokens adjusted;
  unused `extraLinks` removed from the sidebar.

## Health checks after the pull

- `check:policy` — 111 handlers, all authorised (one new: password-code flow).
- `check:validators` — 76 validators, prod and demo in step.
- `check:tenancy` — clean.
- Playwright smoke (performance, retention, earnings, profile, patients,
  dashboard) — all load with zero console/page errors.
- Floating-dock and voice/AI features from the previous commits untouched
  except one hover-colour tweak in the chat inbox.

## Regressions found and fixed on top of the pull

The incoming commits added 18 TypeScript errors (the repo compiles with
`exactOptionalPropertyTypes`, which the new components did not account for):

- `earnings-lines-table.tsx`, `my-performance-kpis.tsx`,
  `staff-performance-kpis.tsx` — optional props (`inset`, `tone`, `change`,
  `invert`, `invertChange`, `moneyChange`, `moneyValue`, `patientId`) widened
  to `… | undefined` so callers may pass explicit `undefined` (14 errors).
- `earnings.tsx` line-type mismatch — resolved by the `patientId` widening.
- `security-settings.tsx` — the `sendPasswordEmailCode` mutation result was
  used untyped (3 errors); the `onSuccess` handler now narrows it explicitly.

No behavioural changes; `tsc` is back to the pre-pull baseline.
