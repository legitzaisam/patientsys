# Responsive QC audit and fixes — work log

Both portals and the demo across phones, tablets, laptops and desktops. Stage 1 (branch `e2e`, `8ac2fbb`) built the device-matrix harness, captured every page in every role at seven widths and ranked what it found; Stage 2 (branch `e2e_live`, cut from `94fc1b6`) fixed the findings tier by tier and turned the probes into a gate. Plan: `.cursor/plans/responsive_qc_audit_and_fixes_83c7e2bf.plan.md`.

## How to run it

```
npm run test:responsive        # all 7 projects: matrix + WebKit touch checks, report-only
npm run test:responsive:gate   # matrix with RESPONSIVE_GATE=major — a page fails if a major or blocker remains
npm run qc:responsive          # matrix, then docs/responsive/REPORT.md (+ curated captures with --captures)
node scripts/responsive-report.mjs --captures
```

Seven Playwright projects in `playwright.responsive.config.ts`: iPhone SE 375, iPhone 15 393, iPad Mini 768 portrait and iPad Pro 1194 landscape in **WebKit** (touch on), Laptop 1366, Laptop 1440 and Desktop 1920 in Chromium. Demo mode on port 8091; `RESPONSIVE_WORKERS` (default 3) and `RESPONSIVE_REUSE_SERVER=1` for local runs. Results land in `test-results-responsive/` (a sibling of `test-results/`, because the regression suite wipes its own output directory at the start of every run). A full run is about 25 minutes.

## Stage 1 — harness and audit

| File | What it does |
|---|---|
| `e2e/responsive/pages.ts` | Inventory: 61 pages × roles (public, owner, admin, front desk, practitioner, patient) with settle selectors and the states worth capturing (sidebar closed, account menu, bell, dock panels, quick book, tabs, dialogs, treatment form…). Non-owner staff roles capture a `coreStates` subset. |
| `e2e/responsive/probes.ts` | One `page.evaluate` that measures the page: main and element overflow, reachability of the last element, clipped text (truncate-clipped children excluded), fixed-overlay overlap and overlays over controls (pinned vs scroll-clearable), tap targets (24 px fail, 44 px advisory, text links separately), type floor (10 px) and iOS focus zoom (16 px), dialog fit and close-button reach, the page-header pill rule, runtime errors. |
| `e2e/responsive/matrix.spec.ts` | One test per page × role × project: capture base (viewport + full-page shot), open each state, probe, write `findings/<project>/<role>--<page>--<state>.json`. Only a broken harness fails the test unless `RESPONSIVE_GATE` is set. |
| `e2e/responsive/interactions.spec.ts` | WebKit-only touch checks: taps on tabs, cards, dock, switches, the stage menu; slider drag; carousel swipe; diary drag-to-reschedule; planner pan; sidebar resize. Outcomes `works / tap-alternative / touch-gap / covered / untestable / not-present / error`, written incrementally. |
| `e2e/responsive/fixtures.ts` | Role cookie, runtime-error watcher, shell expansion for full-page shots, output paths. Seeds the dock's "seen" alert count so a fresh session does not peek the cards on every page. |
| `scripts/responsive-report.mjs` | `docs/responsive/REPORT.md`: per-device and per-probe summaries, a scorecard (pages × devices), every finding ranked by severity with a fix hint and a local screenshot link, the touch-check table, and `docs/responsive/REVIEW.md` inlined. `--captures` copies the iPhone SE and iPad Mini base shots for owner and patient to `docs/responsive/captures/` as JPEGs. |
| `docs/responsive/REVIEW.md` | The human read of the captures: 33 numbered items with the smallest fix for each, and (Stage 2) where each landed. |

Stage 1 numbers, blockers / majors / minors: iPhone SE 281 / 317 / 396, iPhone 15 259 / 294 / 396, iPad Mini 42 / 213 / 227, iPad Pro 16 / 231 / 233, 1366 0 / 110 / 2, 1440 0 / 107 / 2, 1920 0 / 64 / 2.

## Stage 2 — fixes

### Tier 1 (`8b977a2`): shell, toolbar, dialogs, page overflow

- **Sidebar as a drawer below `lg`** (`app-shell.tsx`, `use-mobile.tsx` takes a breakpoint): a `Sheet` that is closed by default, not persisted, and closes on navigation; the fixed, resizable column stays from 1024. Account pill is avatar-only under `sm`.
- **Layering**: staff dock, portal dock and demo switcher move from `z-[60]` / `z-50` to `z-40` so dialogs and sheets (`z-50`) are never covered. The alert-card stack no longer peeks below 1280.
- **Dialogs and sheets** (`ui/dialog.tsx`, `ui/sheet.tsx`): `grid-cols-[minmax(0,1fr)]` so wide content scrolls inside instead of widening the dialog; `max-sm:w-[calc(100vw-2rem)]`; larger close buttons; tall dialogs get `max-h-[calc(100dvh-2rem)] overflow-y-auto` (offer automation, send offer, send history, consent in clinic, step-up, schedule, patients, record). Dock panels and the chat window pin to the viewport under `sm`.
- **Pages**: record action row wraps; Patients toolbar stacks with a scrolling chip row (`.scroll-x-plain`) and a shadowed table scroller (`.scroll-x-shadows`, `min-w-[720px]`); day planner and week diary scrollers show edge shadows; Insights controls stack under the title; period picker, performance and settings toolbars wrap or scroll; portal KPI tiles can shrink; Quick book columns can shrink; treatment-form step rail gets `min-w-0` on the `li`.
- **16 px form fields under 768 px** (one rule in `styles.css`) so iOS Safari does not zoom on focus.

### Tier 2 and 3 (this commit): overlaps, tap targets, type floor, tablet layouts

- **Week and month diary on phones** (`schedule.tsx`): the week grid stacks to one day per row under `md` (seven columns from `md`, `min-w-[1820px]` inside the shadowed scroller); the month grid keeps a 3.75 rem row minimum, wraps the day-number / count row and hides the event list under `sm` so the count badges survive.
- **Stage menu on touch** (`today-snapshot.tsx`): Radix HoverCard ignores taps, so the trigger records `pointerType` and toggles a controlled `open` on touch (`(hover: none)` as the fallback).
- **Demo pill on phones** (`demo/role-switcher.tsx`): a compact "Demo" pill in the toolbar row next to the sidebar button under `sm`, menu opening downwards; bottom-left from `sm`.
- **Dock clearance for sticky chat panels** (`floating-dock.tsx`, `patient-chat-panel.tsx`, `staff-chat-panel.tsx`): the dock measures its launcher row with a `ResizeObserver` and publishes `--dock-h` on `:root`; the record and team chat panels subtract it from their height from `md`, so Attach / Templates / Send are never under the Alerts pill. Only the persistent row counts: the alert cards that peek or open above it are transient and may cover the panel while they are up.
- **Tap targets to the 24 px minimum without changing the visuals**: `Checkbox` and `Switch` keep their 16 px box and 20 × 36 track but the button around them is 24 px (`-m-1` / `-my-0.5` keep rows the same height; checked and focus styles move to `group-*` variants); the colour swatches and reset button in the treatment catalogue, the booking-notes chip, the bell's dismiss, the dock's previous / next / snooze / collapse buttons, the chat panels' A− / A+, PortalLink ("See all", "View all"…), the record and team back links, the table sort headers, the diary status button, Quick book's "New patient" and the earnings collapsible headers all reach 24 px through padding or a `min-h-6`.
- **Type floor**: plan-track state words 8.5 → 10 px, "Your product" chip 8.5 → 10 px, portal flags 9 → 10 px, routine / journal meta 9.5 → 11 px, offer expiry 11 px; `.staff-chat-alert__label`, `.staff-chat-meta` and `.staff-chat-day` clamp to 10 px at the smallest chat size. The notes editor's inline size clamps to `--input-min-fs` (16 px under 768) so it cannot trigger the iOS zoom either.
- **Tablet layouts beside the chat column**: the team profile card and the staff performance KPI card use Tailwind container queries (`@container`, `@xl:` / `@lg:` / `@md:` / `@sm:`) instead of viewport breakpoints, so at ~340 px beside the chat they stack instead of squeezing the form to 16 px fields and overprinting the money row. The record's photos tab grids use `minmax(0,1fr)` tracks and the WebKit `<select>` (which reports its longest option as scroll width) sits in an `overflow-hidden` box.
- **Portal**: plan tabs become a scrolling pill track under `sm`; the plan header chips stretch and left-align under `sm`; the journal header controls wrap, the entry row wraps its photo strip under `sm`, and the page grid caps its columns; the check-in slider's invisible range input is 34 px tall so a finger catches it; the journeys "Next:" line truncates.
- **Performance pages**: the KPI headers wrap and the period picker scrolls instead of dropping under the title.

### The gate (`RESPONSIVE_GATE`)

`matrix.spec.ts` reads `RESPONSIVE_GATE=blocker|major|minor`; when set, a page's test fails listing every finding at that severity or worse (`state: probe — message (e.g. sample)`). `npm run test:responsive` stays report-only; `npm run test:responsive:gate` runs at `major`, which is green today. Verified both ways: `minor` fails the owner profile on the iPhone SE (a `tap.under-44` row); `blocker` and `major` pass everywhere.

### Probe refinements made along the way

- `overlay.covers-action` now separates controls the user can scroll clear of (`overlay.covers-scrollable`, informational) from pinned ones, accumulating scroll room across nested scrollers; a sticky element rides with its own scroll container but outer scrollers can still move it, a fixed ancestor pins it.
- Menus and popovers (`[role=menu]`, `[data-radix-popper-content-wrapper]`) are transient like dialogs and no longer count as overlays over controls.
- The header rule accepts an eyebrow above the title as part of the title block.
- The matrix collapses a peeking alert card before probing unless the state opened it (the count hooks resolve at different times, so a seeded "seen" count alone cannot prevent the peek), and skips that when a menu or dialog is open.
- Touch checks: the slider scrolls into view first (on the 667 px SE it starts below the fold); a disabled "Completed" routine button is recorded as `not-present` (shared demo state from an earlier device in the run) instead of a timeout.

## Result

After the final full run (442 tests, 1064 captures, 52 touch checks): **0 blockers and 0 majors on every device, 0 runtime errors**. The remaining minors are the advisory probes only — `tap.under-44` (Apple's 44 px guide; everything now clears the 24 px WCAG minimum), `tap.small-link` (text links and time labels under 24 px tall) and `type.small` (10–11 px meta text) — 186 rows on each iPhone, 144 on the iPad Mini, 204 on the iPad Pro, none on laptops or the desktop. Touch: everything taps; carousel swipe, drag-to-reschedule and the sidebar resize keep their tap alternatives (arrows, the appointment dialog's time editor, the open / close buttons); a sideways finger pan of the day planner cannot be emulated from this harness and remains a manual check on a real iPad.

## Verification

- `check:policy` (161 handlers), `check:validators` (115), `check:tenancy` (52 tables): ok.
- Unit: 132 / 133 pass. The one failure, `tests/unit/policy-scope.test.ts` › "keeps destructive team administration on the owner", is pre-existing on the pulled commits (`setRolePermission` now opens to `admin`) and untouched here.
- Chromium regression e2e: 126 / 131 pass. The five failures are the same five that fail at the branch point `94fc1b6` (verified by stashing): `feedback-corrections.spec.ts:57`, `:122`, `:137` (period-pill labels still read "1 year" where the tests expect "This year"; the notes pre-read), `offers.spec.ts:84` (Draft with AI), `reminders.spec.ts:10` (long-standing). `treatment-workflow.spec.ts:63` failed at the branch point and passes now.
- `tsc --noEmit`: 103 errors, identical to the branch-point baseline.
- ESLint on the 41 changed source and harness files: no new findings versus the baseline (the pre-existing `no-explicit-any`, `exhaustive-deps` and `only-export-components` counts are unchanged; Prettier findings are not reformatted, the repo has ~2,900 of them).

## Left for a later pass

- `tap.under-44`: raising primary phone actions to `h-11` would be a design decision across both portals.
- Sideways pan of the day planner on a touch device: pointer-down is captured for drag-to-reschedule; a real-device check is needed to confirm two-finger or edge scrolling is enough, or the drag should require a long-press on touch.
- The five pre-existing e2e failures and the `policy-scope` unit test come from the access-catalogue / admin-role pull and belong with that work.
