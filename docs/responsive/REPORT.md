# Responsive QC report

Generated 2026-09-26 13:36 from 1064 captures across 7 device projects (iPhone SE 375, iPhone 15 393, iPad Mini 768, iPad Pro 1194, Laptop 1366, Laptop 1440, Desktop 1920). iPhone and iPad ran in WebKit; laptop and desktop in Chromium. Demo mode, port 8091.

Findings are grouped by probe, page and state; one row lists every device it affects. Severity → tier: blocker → Tier 1, major → Tier 2, minor → Tier 3. `npm run test:responsive` reports only; `npm run test:responsive:gate` runs the matrix with RESPONSIVE_GATE=major (blocker and minor are the other levels) and fails a page's test when findings at that severity or worse remain.

## Summary by device

| Device | Pages captured | States captured | Blockers | Majors | Minors | Runtime errors |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone SE 375 | 61 | 106 | 0 | 0 | 186 | 0 |
| iPhone 15 393 | 61 | 106 | 0 | 0 | 186 | 0 |
| iPad Mini 768 | 61 | 106 | 0 | 0 | 144 | 0 |
| iPad Pro 1194 | 61 | 151 | 0 | 0 | 204 | 0 |
| Laptop 1366 | 61 | 151 | 0 | 0 | 0 | 0 |
| Laptop 1440 | 61 | 151 | 0 | 0 | 0 | 0 |
| Desktop 1920 | 61 | 151 | 0 | 0 | 0 | 0 |

## Summary by probe

| Probe | Severity | Rows | Phone | Tablet | Laptop | Desktop | What it means |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tap.under-44` | minor | 150 | 105 | 150 | 0 | 0 | Advisory: Apple recommends 44px. Raise primary actions on phones (h-11) and leave secondary controls as they are. |
| `tap.small-link` | minor | 54 | 39 | 54 | 0 | 0 | Text links shorter than 24px: add py-1 or line-height so the hit area reaches 24px. |
| `type.small` | minor | 42 | 42 | 0 | 0 | 0 | 10-11px meta text: acceptable for labels, raise anything the user must read. |
| `overlay.covers-scrollable` | info | 95 | 52 | 57 | 65 | 25 | Informational: the dock covers this control at load, but scrolling clears it. No action. |

## Headline

- Phones: 0 blocker rows over 0 pages.
- Tablets: 0 blocker rows over 0 pages.
- Laptop and desktop: 0 blocker rows over 0 pages.

## Scorecard by page

Worst finding on the page across its states. B = blocker, M = major, m = minor, ok = clean, — = not visited (redirected or not in that role's set). The second symbol, after the slash, is the page with the sidebar closed, which is how a phone user would actually hold it.

| Page | iPhone SE 375 | iPhone 15 393 | iPad Mini 768 | iPad Pro 1194 | Laptop 1366 | Laptop 1440 | Desktop 1920 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| public/auth | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| public/auth-reset | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| public/consent-link | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| public/landing | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| public/portal-login | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| public/unsubscribe-link | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| owner/dashboard | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/insights | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/insights-book | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/offers | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/patient-record | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/patients | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/patients-board | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/performance | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/profile | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/retention | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/schedule-day | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/schedule-month | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/schedule-week | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/settings | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/team | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| owner/team-member | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/access | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| admin/dashboard | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/insights | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| admin/offers | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| admin/patient-record | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/patients | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/performance | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| admin/profile | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/schedule-day | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| admin/settings | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| admin/team | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/dashboard | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/insights | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| front_desk/patient-record | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/patients | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/profile | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/retention | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| front_desk/schedule-day | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| front_desk/settings | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| front_desk/team | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/dashboard | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/earnings | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| practitioner/patient-record | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/patients | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/profile | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/retention | m/— | m/— | m/— | m/— | ok/— | ok/— | ok/— |
| practitioner/schedule-day | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/team | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| practitioner/team-member | — | — | — | — | — | — | — |
| patient/portal-appointments | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-billing | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-clinic | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-home | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-journal | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-plan | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-records | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-resources | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-routine | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-settings | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |
| patient/portal-timeline | m/— | m/— | m/— | m/m | ok/ok | ok/ok | ok/ok |

## Manual review of the captures

What the probes cannot see: alignment, wraps, what a real hand would do. Read against the phone (iPhone SE 375, WebKit) and tablet (iPad Mini 768 portrait, WebKit) captures in `captures/`, with iPad Pro 1194 landscape and the 1366 laptop for the in-between widths. Each note names the surface, what is wrong, and the smallest fix that would hold across both portals.

### Stage 2 outcome (26 Sep 2026, `e2e_live`)

The notes below are the Stage 1 review, kept as written so the fixes can be read against them. After Tier 1–3 the same 7-device matrix reads:

| Device | Stage 1 blockers / majors / minors | Stage 2 blockers / majors / minors |
| --- | --- | --- |
| iPhone SE 375 | 281 / 317 / 396 | 0 / 0 / 186 |
| iPhone 15 393 | 259 / 294 / 396 | 0 / 0 / 186 |
| iPad Mini 768 | 42 / 213 / 227 | 0 / 0 / 145 |
| iPad Pro 1194 | 16 / 231 / 233 | 0 / 0 / 206 |
| Laptop 1366 | 0 / 110 / 2 | 0 / 0 / 0 |
| Laptop 1440 | 0 / 107 / 2 | 0 / 0 / 0 |
| Desktop 1920 | 0 / 64 / 2 | 0 / 0 / 0 |

The remaining minors are the three advisory probes: `tap.under-44` (controls between 24 and 43 px — Apple's 44 px guide; every control now clears the 24 px WCAG minimum), `tap.small-link` (text links and time labels under 24 px tall) and `type.small` (10–11 px meta text). No overflow, no unreachable content, no clipped text, no control under a pinned overlay, no runtime errors on any device. Where each item below landed:

- Items 1, 2, 4 (shell, toolbar, 16 px fields): Tier 1. Item 3 (floating chrome): Tier 1 for layering, Tier 2 for the phone placement of the demo pill and the dock panels; the staff dock now publishes its launcher-row height as `--dock-h` and the record / team chat panels reserve it, so the composer is never under the Alerts pill (the alert cards that peek or open above it are transient and may cover the panel briefly).
- Items 5–11 (dashboard, diary, record, patients, insights, team, settings on phones): Tier 1 and 2. The week diary stacks to one day per row and the month grid keeps its count badges under `sm`; the record's photos tab and the team profile card use container queries so they stack when the chat column leaves them ~340 px.
- Items 12–20 (portal on phones): Tier 2 and 3, including the plan-track labels (10 px floor), the plan tabs (scrolling track), the journal header and photo strip, and the check-in slider (34 px hit area).
- Items 21–26 (iPad Mini): the sidebar is a drawer below `lg`, which gives the tablet the full width; the record and team pages keep their chat column at `md` with the content column made to fit.
- Items 27–28 (iPad Pro, 1366): the dock's `overlay.covers-action` rows were the alert-card carousel at load and the dashboard alert-count race (two hooks resolve at different times); the probe now separates controls the user can scroll clear of (`overlay.covers-scrollable`, informational) from pinned ones, and the matrix probes with a peeking card collapsed unless the state opened it. The 1194 KPI grid stays three columns (a `min-[1180px]` variant loses to `lg:` in Tailwind's ordering).
- Items 30–33 (touch): the stage menu opens on tap; the slider moves under a finger on both iPhones; the routine tap timeout was shared demo state (an earlier device had completed the step) and is now recorded as such; the carousel swipe, drag-to-reschedule and sidebar resize keep their tap alternatives; a sideways finger pan of the day planner is still untestable from this harness.
- Item 29 (demo pill): a compact "Demo" pill in the toolbar row under `sm`, menu opening downwards.

### The shell (every page, both portals)

1. **The sidebar is a fixed column at every width.** On a 375 px phone it takes 238 px (the stored width, up to 420) and the page is squeezed into the remainder. Because the shell is `h-dvh overflow-hidden` and the main column is `min-w-0`, the content does not scroll sideways for the user: it is clipped. Every staff and portal page inherits this, which is why the phone column of the scorecard is all blockers with the sidebar open. With the sidebar closed the same pages mostly work. Fix: under `md` render the sidebar as an off-canvas drawer (the unused `Sheet` branch in `ui/sidebar.tsx`), default it closed, do not persist `open` under `md`, and hide the resize handle. Blocker, Tier 1.
2. **The toolbar does not compact.** Alert team, notes, sent alerts, bell and the 220 px account pill sit in one `flex` row. With the sidebar open at 375 the row starts at x = 258 and runs to 591; with it closed the chips fit but the pill wraps the name. Fix: under `sm` collapse the three alert chips into one overflow menu and show the account pill as avatar-only. Tier 1 (part of the drawer work).
3. **Floating chrome shares one corner.** Demo role switcher (bottom-left), staff dock or portal dock (bottom-right, `z-60`), the dock's alert card stack, and Sonner toasts. On phones the switcher and the dock's Alerts pill overlap (169 × 38 px on the dashboard) and both cover the last card of every page; the dock is drawn above dialogs and sheets (`z-50`), so on phones it sits on the Cancel / Save row of the offer editor and on Quick book's Book appointment button. On the iPad Pro landscape it covers the Day / Week / Quick book controls of the dashboard diary strip. Fix: on phones stack the dock bubbles vertically and hide the alert card carousel behind the bubble; move the demo switcher to the top toolbar under `md` (it is demo-only chrome, but it is also the thing the client sees first); hide the dock while a dialog is open or lower it below the dialog layer; and give `#app-main-scroll` bottom padding equal to the dock height on phones. Tier 1 for the dialog overlap, Tier 2 for the rest.
4. **Form fields are 12.5–14 px.** Safari zooms the page when they gain focus. `input[aria-label="Search patients"]` 12.5 px, `textarea#alert-body` 13.5 px, the portal chat textarea 14 px, the AI box 12 px. Fix: `text-base` (16 px) on inputs, selects and textareas under `md`. Tier 1 (one rule in `styles.css`).

### Clinic portal, phone (375, sidebar closed)

5. **Dashboard** stacks cleanly: KPI cards, diary strip, attention lists all single-column and readable. Only the overlay cluster at the bottom hides the last card. Ok apart from item 3.
6. **Diary, day view.** The planner is `min-w-[680px]` inside an `overflow-auto` box, so the practitioner columns run off the right with no edge fade, no scroll hint and, because pointer-down starts a drag-to-reschedule, a finger cannot scroll it sideways (touch check `day-planner-horizontal-scroll`). Fix: under `md` show one practitioner at a time (the existing View by select) or a stacked list per practitioner, and reserve horizontal drag for a two-finger or long-press gesture. Tier 1.
7. **Diary, week and month.** The week grid is cut on the left (the first days are hidden behind the card edge) and the month heat-map compresses to unreadable cells. Fix: week under `md` becomes a vertical list of days; month keeps the grid but with a tappable day that opens the day list. Tier 2.
8. **Patients.** The four view chips (All / Active / Inactive / Treatments due) wrap into a tall stack on the left while the two search inputs and New patient stay on the right, so the inputs overlay the chips. The table then needs sideways scrolling to reach Task and Status. Fix: chips row full width with `overflow-x-auto` and no wrap; search inputs on their own row; under `md` render the roster as cards (name, last treatment, next, status) instead of the six-column table. Tier 1 (the table), Tier 2 (the toolbar).
9. **Patient record.** The header card overflows: the identity line (`reference · DOB · email · phone`) and the four action buttons (`Record treatment` / `Send form` / `Send offer` / `Archive`) are in a non-wrapping `flex`, so the card is wider than the screen. The six tabs wrap onto two lines, which is acceptable. The always-on chat rail (280–520 px) appears below the record on phones, which is the right call. Fix: `flex-wrap` on the identity line and the button row; a single `More` menu for the secondary actions under `sm`. Tier 1.
10. **Insights.** The header puts the Pipeline / Book pill and the period picker beside the title in one row; at 375 the pill sits on top of the word "Insights" and the period picker runs off the right edge. This violates the pill rule's mobile branch (stack under 640). Fix: put both controls in `.page-header`'s last child so the existing `flex-direction: column` rule stacks them, and let the period picker scroll horizontally. Tier 1.
11. **Retention.** The five-segment period picker is wider than the screen and, because `.page-header > :last-child` is `align-self: flex-end` under 640, it overflows to the left ("eek" is all that is left of "1 week"). Fix: allow the pill track to scroll (`overflow-x-auto`, no wrap) or hide the two rarest presets under `sm`. Tier 2.
12. **Offers, Team, Settings, Profile, Performance.** Stack well; buttons wrap to the right under the title as the header rule intends. Team's search toggle, pill and Invite staff fit at 375. Ok apart from items 3 and 4.
13. **Dialogs and sheets on phones.** Quick book is a popover anchored to its button and is drawn under the dock; the booking and record-treatment dialogs are `max-w-lg` / `w-[calc(100vw-2rem)]` and fit; the **three-page treatment form does not**: at 375 its title line, the step rail and both content cards run past the right edge (the `overflow.elements` probe counts 11 elements in the `treatment-form` state), and the dock's Alerts pill sits on the bottom of the form. The offer editor sheet is full width (`w-full sm:max-w-[1040px]`) and scrolls, but its footer is under the dock. The care-assistant panel in the portal dock is anchored to the bubble (`absolute right-0`, 340 px) and starts at x = −23 on a 393 px screen. Fix: dock beneath dialogs (item 3); anchor the dock panels to the viewport (`fixed inset-x-4 bottom-24`) under `sm`. Tier 1.
14. **Today-card detail dialog.** Tapping a stage badge inside the dialog opens the journey HoverCard immediately, and the same HoverCard is the only way to change the stage from the diary strip; a hover-only control has no touch equivalent (touch check `stage-menu-tap`). Fix: on touch devices open the stage menu on tap (Radix HoverCard → Popover when `hasTouch`). Tier 2.
15. **Tap targets.** Icon buttons in the toolbar are 36 px (fine), close buttons in dialogs 16 px, the diary carousel arrows 28 px, the notification pills 18–20 px, the payment / consent chips 20 px high. Fix: `h-9 w-9` minimum for icon buttons on touch, `min-h-6` for chips that act as buttons. Tier 2.
16. **Type.** The plan progress track labels are 9.5 px and the offer expiry line 10.5 px; the KPI chip text is 11 px. Raise the track labels to 11 px and let them wrap. Tier 3.

### Patient portal, phone (375, sidebar closed)

17. **Home.** The content column is 61 px wider than the screen with the sidebar closed, so the KPI tiles run past the right edge (the tiles themselves truncate correctly; something further down the page, most likely a non-wrapping button row in the appointment or offer card, sets the width). The Special offers, Clinic news and appointment cards stack correctly; the offer card's Book button is under the dock bubbles when it is the last card. Fix: find the widest row with the `overflow.elements` samples and let it wrap. Tier 1 (overflow), Tier 2 (dock).
18. **Skin plan.** The three KPI chips (completion ring, clinician, next appointment) are the last child of `.page-header` with `justify-end`, so under 640 they inherit `align-self: flex-end` and sit ragged-right under the title. The Overview / Timeline / Journal / Skincare Routine pill wraps "Skincare Routine" onto two lines inside a 34 px track. Fix: give the chip row `self-stretch justify-start` under `sm`; let the pill track scroll or shorten the subtitle, never the labels. Tier 2.
19. **Timeline.** The roadmap header squeezes the copy beside the progress bar; step cards are readable; the Pause plan modal fits. Tier 3.
20. **Journal, Routine, Records, Appointments, Billing, Settings, Resources.** Single column, readable. The Records page's photo strip and the Routine step cards fit. Settings switches are 36 × 20 px (tap check `settings-switch-tap` passes but is under the 44 px guide). Ok apart from items 3 and 4.

### Tablet, iPad Mini 768 portrait (sidebar open, 530 px content column)

21. **Dashboard** collapses to two KPI columns and reads well; the dock's alert card carousel (300 px) sits over the diary strip and the Attention lists. Item 3 applies.
22. **Diary, day view.** Two of three practitioner columns are visible; the third needs a sideways scroll with no affordance. Same fix as item 6 with the breakpoint at `lg`, or shrink the hour gutter and column min-width so three columns fit at 530 px.
23. **Patient record** is the worst tablet page with the sidebar open: the record column and the chat rail share the 530 px, the record shrinks to about 110 px and the Allergies / Medication / Conditions labels overprint each other. With the sidebar closed the two columns fit at roughly 330 px each, but the action-button row still runs past the record card (Archive is cut). Fix: the chat rail becomes a bottom sheet or a tab under `lg`, not a side column; wrap the button row. Tier 1.
24. **Patients.** The chip-vs-search collision from item 8 is worse here: chips wrap into four rows beside the inputs. Same fix.
25. **Insights, Retention.** Fit, with the period picker pushed to a second row. Ok.
26. **Portal** pages at 768 are fine: two-column card grids, readable tiles.

### iPad Pro 1194 landscape and laptop 1366

27. At 1194 the dashboard KPI grid is three columns with a two-card second row (a `xl:grid-cols-5` that only kicks in at 1280); acceptable but uneven. The dock covers the diary strip's Day / Week / Quick book controls. Tier 3 (grid), Tier 2 (dock).
28. At 1366 and above every page renders as designed. The "M" cells in the laptop and desktop columns of the scorecard come from two probes only: `overlay.covers-action` (the dock's alert-card carousel sitting over whatever control happens to be in the bottom-right corner at load, 48–96 rows) and `type.tiny` (the 9.5 px plan-track labels, 17 rows, the same on every device). No overflow, no unreachable content, no clipped text beyond those labels.

### Touch checks (WebKit, all four devices)

30. Taps work for tabs, the today-card dialog and its Close, the dock inbox, portal switches (36 × 20 px), the routine "Mark as complete" and the portal chat. The carousel arrows work; a finger swipe on the diary strip does not scroll it, and the arrows are the alternative.
31. Two controls have no touch path: the **stage menu** (a HoverCard: a tap does nothing, or on the iPhone SE the badge is under the dock and cannot be tapped at all) and **sideways scrolling of the day planner** (pointer-down is captured for drag-to-reschedule, so a finger drag neither scrolls nor moves the block). Drag-to-reschedule itself has a tap alternative (the appointment dialog's time editor); the sidebar resize handle has the open / close buttons.
32. The **recovery check-in slider** did not move under a finger drag on either iPhone (it did on both iPads): the 26 px track is too thin to catch the gesture reliably. A taller track or ±buttons beside it would fix this.
33. On the iPad Mini and iPad Pro the tap on a diary card did not open its dialog within the time limit, and on three of four devices the routine "Mark as complete" tap timed out: in both cases the dock's alert-card carousel was over the control. Same root cause as item 3.

### Not a layout bug, but seen on every phone capture

29. **The demo role switcher** is the first thing a client sees on a phone and it collides with everything. Moving it into the top toolbar under `md` (or behind a small pill that expands on tap) would remove a third of the overlay findings on its own without touching product UI.

## Tier 1 — blockers (0 rows)

None.

## Tier 2 — majors (0 rows)

None.

## Tier 3 — minors (246 rows)

<details><summary>Pages (154)</summary>

| Probe | Where | Devices | Detail | Shot |
| --- | --- | --- | --- | --- |
| `tap.under-44` | admin · access · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 112 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--access--base.png) |
| `tap.small-link` | public · auth-reset · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.mt-2.w-full.text-2xs "Forgot password?" 269×16 | [shot](captures/iphone-se/public--auth-reset--base.jpg) |
| `tap.under-44` | public · auth-reset · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 6 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. input#email.flex.h-9.w-full 269×36 | [shot](captures/iphone-se/public--auth-reset--base.jpg) |
| `tap.small-link` | public · auth · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.mt-2.w-full.text-2xs "Forgot password?" 269×16 | [shot](captures/iphone-se/public--auth--base.jpg) |
| `tap.under-44` | public · auth · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 6 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. input#email.flex.h-9.w-full 269×36 | [shot](captures/iphone-se/public--auth--base.jpg) |
| `tap.under-44` | public · consent-link · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. a.flex.items-center.gap-2.5 "ÆAetheria" 103×30 | [shot](captures/iphone-se/public--consent-link--base.jpg) |
| `tap.small-link` | admin · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--base.png) |
| `tap.small-link` | front_desk · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--base.png) |
| `tap.small-link` | owner · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [shot](captures/iphone-se/owner--dashboard--base.jpg) |
| `tap.small-link` | practitioner · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 11 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--base.png) |
| `tap.under-44` | admin · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 120 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--base.png) |
| `tap.under-44` | front_desk · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 72 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--base.png) |
| `tap.under-44` | owner · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 120 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--dashboard--base.jpg) |
| `tap.under-44` | practitioner · dashboard · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 51 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--base.png) |
| `tap.under-44` | practitioner · earnings · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 48 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--earnings--base.png) |
| `tap.under-44` | owner · insights-book · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 11 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--insights-book--base.jpg) |
| `tap.under-44` | admin · insights · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 69 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--insights--base.png) |
| `tap.under-44` | front_desk · insights · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 69 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--insights--base.png) |
| `tap.under-44` | owner · insights · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 69 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--insights--base.jpg) |
| `tap.under-44` | public · landing · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 3 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. a.flex.items-center.gap-2.5 "ÆAetheria" 103×30 | [shot](captures/iphone-se/public--landing--base.jpg) |
| `tap.under-44` | admin · offers · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--offers--base.png) |
| `tap.under-44` | owner · offers · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--offers--base.jpg) |
| `tap.under-44` | admin · patient-record · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 26 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--base.png) |
| `tap.under-44` | front_desk · patient-record · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 25 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--base.png) |
| `tap.under-44` | owner · patient-record · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--patient-record--base.jpg) |
| `tap.under-44` | practitioner · patient-record · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 26 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--base.png) |
| `tap.under-44` | owner · patients-board · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 14 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--patients-board--base.jpg) |
| `tap.under-44` | admin · patients · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--patients--base.png) |
| `tap.under-44` | front_desk · patients · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--patients--base.png) |
| `tap.under-44` | owner · patients · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--patients--base.jpg) |
| `tap.under-44` | practitioner · patients · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--patients--base.png) |
| `tap.under-44` | admin · performance · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--performance--base.png) |
| `tap.under-44` | owner · performance · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--performance--base.jpg) |
| `tap.under-44` | patient · portal-appointments · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 8 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-appointments--base.jpg) |
| `tap.small-link` | patient · portal-billing · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1 text link shorter than 24px (wide enough to hit, but thin). — e.g. button.cursor-pointer.font-semibold.underline "message your clinic" 115×20 | [shot](captures/iphone-se/patient--portal-billing--base.jpg) |
| `tap.under-44` | patient · portal-billing · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-billing--base.jpg) |
| `tap.under-44` | patient · portal-clinic · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-clinic--base.jpg) |
| `tap.under-44` | patient · portal-home · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 18 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-home--base.jpg) |
| `tap.under-44` | patient · portal-journal · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-journal--base.jpg) |
| `tap.small-link` | public · portal-login · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.mt-3.w-full.text-sm "Forgot password?" 261×20 | [shot](captures/iphone-se/public--portal-login--base.jpg) |
| `tap.under-44` | public · portal-login · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 5 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. input#portal-email.flex.h-9.w-full 261×36 | [shot](captures/iphone-se/public--portal-login--base.jpg) |
| `tap.under-44` | patient · portal-plan · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-plan--base.jpg) |
| `tap.under-44` | patient · portal-records · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 45 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-records--base.jpg) |
| `tap.under-44` | patient · portal-resources · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 6 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-resources--base.jpg) |
| `tap.under-44` | patient · portal-routine · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 23 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-routine--base.jpg) |
| `tap.under-44` | patient · portal-settings · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 8 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-settings--base.jpg) |
| `tap.under-44` | patient · portal-timeline · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 12 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/patient--portal-timeline--base.jpg) |
| `tap.under-44` | admin · profile · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 23 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--profile--base.png) |
| `tap.under-44` | front_desk · profile · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 24 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--profile--base.png) |
| `tap.under-44` | owner · profile · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--profile--base.jpg) |
| `tap.under-44` | practitioner · profile · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--profile--base.png) |
| `tap.small-link` | front_desk · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 137 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.text-foreground.underline-offset-4.hover:underline "Miss Adele Nethercombe" 167×20 | [local](../../test-results-responsive/shots/iphone-se/front_desk--retention--base.png) |
| `tap.small-link` | owner · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 137 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.text-foreground.underline-offset-4.hover:underline "Miss Adele Nethercombe" 167×20 | [shot](captures/iphone-se/owner--retention--base.jpg) |
| `tap.small-link` | practitioner · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 62 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.text-foreground.underline-offset-4.hover:underline "Mrs Martha Medham" 138×20 | [local](../../test-results-responsive/shots/iphone-se/practitioner--retention--base.png) |
| `tap.under-44` | front_desk · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 306 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--retention--base.png) |
| `tap.under-44` | owner · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 306 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--retention--base.jpg) |
| `tap.under-44` | practitioner · retention · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 156 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--retention--base.png) |
| `tap.small-link` | admin · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 163×15 | [local](../../test-results-responsive/shots/iphone-se/admin--schedule-day--base.png) |
| `tap.small-link` | front_desk · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 163×15 | [local](../../test-results-responsive/shots/iphone-se/front_desk--schedule-day--base.png) |
| `tap.small-link` | owner · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 163×15 | [shot](captures/iphone-se/owner--schedule-day--base.jpg) |
| `tap.small-link` | practitioner · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 163×15 | [local](../../test-results-responsive/shots/iphone-se/practitioner--schedule-day--base.png) |
| `tap.under-44` | admin · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--schedule-day--base.png) |
| `tap.under-44` | front_desk · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--schedule-day--base.png) |
| `tap.under-44` | owner · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--schedule-day--base.jpg) |
| `tap.under-44` | practitioner · schedule-day · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--schedule-day--base.png) |
| `tap.under-44` | owner · schedule-month · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 59 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--schedule-month--base.jpg) |
| `tap.small-link` | owner · schedule-week · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 128 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.inline-flex.items-center.text-left "09:15–10:00" 67×16 | [shot](captures/iphone-se/owner--schedule-week--base.jpg) |
| `tap.under-44` | owner · schedule-week · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 83 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--schedule-week--base.jpg) |
| `tap.under-44` | admin · settings · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 367 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--settings--base.png) |
| `tap.under-44` | front_desk · settings · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 367 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--settings--base.png) |
| `tap.under-44` | owner · settings · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 368 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--settings--base.jpg) |
| `tap.under-44` | owner · team-member · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 34 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--team-member--base.jpg) |
| `tap.small-link` | admin · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 301×20 | [local](../../test-results-responsive/shots/iphone-se/admin--team--base.png) |
| `tap.small-link` | front_desk · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 301×20 | [local](../../test-results-responsive/shots/iphone-se/front_desk--team--base.png) |
| `tap.small-link` | owner · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara OseiYou" 301×22 | [shot](captures/iphone-se/owner--team--base.jpg) |
| `tap.small-link` | practitioner · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 301×20 | [local](../../test-results-responsive/shots/iphone-se/practitioner--team--base.png) |
| `tap.under-44` | admin · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--team--base.png) |
| `tap.under-44` | front_desk · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 13 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--team--base.png) |
| `tap.under-44` | owner · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 75 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [shot](captures/iphone-se/owner--team--base.jpg) |
| `tap.under-44` | practitioner · team · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 13 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--team--base.png) |
| `tap.under-44` | public · unsubscribe-link · base | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. a.flex.items-center.gap-2.5 "ÆAetheria" 103×30 | [shot](captures/iphone-se/public--unsubscribe-link--base.jpg) |
| `type.small` | admin · dashboard · base | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--base.png) |
| `type.small` | front_desk · dashboard · base | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--base.png) |
| `type.small` | owner · dashboard · base | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [shot](captures/iphone-se/owner--dashboard--base.jpg) |
| `type.small` | practitioner · dashboard · base | iPhone 375, iPhone 393 | 2 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--base.png) |
| `type.small` | admin · patient-record · base | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--base.png) |
| `type.small` | front_desk · patient-record · base | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--base.png) |
| `type.small` | owner · patient-record · base | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [shot](captures/iphone-se/owner--patient-record--base.jpg) |
| `type.small` | practitioner · patient-record · base | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--base.png) |
| `type.small` | patient · portal-home · base | iPhone 375, iPhone 393 | 11 text elements between 10 and 11px on a phone. — e.g. p.mt-1.5.line-clamp-2.break-words "Consultation & consent" 10.5px | [shot](captures/iphone-se/patient--portal-home--base.jpg) |
| `type.small` | patient · portal-records · base | iPhone 375, iPhone 393 | 4 text elements between 10 and 11px on a phone. — e.g. span.absolute.bottom-1.left-1 "after" 10.0px | [shot](captures/iphone-se/patient--portal-records--base.jpg) |
| `type.small` | patient · portal-resources · base | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span.inline-flex.items-center.gap-1 "New offer" 10.0px | [shot](captures/iphone-se/patient--portal-resources--base.jpg) |
| `type.small` | patient · portal-routine · base | iPhone 375, iPhone 393 | 9 text elements between 10 and 11px on a phone. — e.g. p.min-w-0.flex-1.text-[10.5px] "Use a pea-sized amount on damp skin, mas" 10.5px | [shot](captures/iphone-se/patient--portal-routine--base.jpg) |
| `type.small` | owner · team-member · base | iPhone 375, iPhone 393 | 11 text elements between 10 and 11px on a phone. — e.g. span.staff-chat-day.font-medium "Yesterday" 10.1px | [shot](captures/iphone-se/owner--team-member--base.jpg) |
| `tap.small-link` | admin · dashboard · sidebar-closed | iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--dashboard--sidebar-closed.png) |
| `tap.small-link` | front_desk · dashboard · sidebar-closed | iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--dashboard--sidebar-closed.png) |
| `tap.small-link` | owner · dashboard · sidebar-closed | iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--dashboard--sidebar-closed.png) |
| `tap.small-link` | practitioner · dashboard · sidebar-closed | iPad 1194 | 11 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--dashboard--sidebar-closed.png) |
| `tap.under-44` | admin · dashboard · sidebar-closed | iPad 1194 | 120 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--dashboard--sidebar-closed.png) |
| `tap.under-44` | front_desk · dashboard · sidebar-closed | iPad 1194 | 72 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--dashboard--sidebar-closed.png) |
| `tap.under-44` | owner · dashboard · sidebar-closed | iPad 1194 | 120 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--dashboard--sidebar-closed.png) |
| `tap.under-44` | practitioner · dashboard · sidebar-closed | iPad 1194 | 51 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--dashboard--sidebar-closed.png) |
| `tap.under-44` | owner · insights-book · sidebar-closed | iPad 1194 | 11 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--insights-book--sidebar-closed.png) |
| `tap.under-44` | owner · insights · sidebar-closed | iPad 1194 | 69 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--insights--sidebar-closed.png) |
| `tap.under-44` | owner · offers · sidebar-closed | iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--offers--sidebar-closed.png) |
| `tap.under-44` | admin · patient-record · sidebar-closed | iPad 1194 | 26 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--patient-record--sidebar-closed.png) |
| `tap.under-44` | front_desk · patient-record · sidebar-closed | iPad 1194 | 25 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--patient-record--sidebar-closed.png) |
| `tap.under-44` | owner · patient-record · sidebar-closed | iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--patient-record--sidebar-closed.png) |
| `tap.under-44` | practitioner · patient-record · sidebar-closed | iPad 1194 | 26 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--patient-record--sidebar-closed.png) |
| `tap.under-44` | owner · patients-board · sidebar-closed | iPad 1194 | 14 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--patients-board--sidebar-closed.png) |
| `tap.under-44` | admin · patients · sidebar-closed | iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--patients--sidebar-closed.png) |
| `tap.under-44` | front_desk · patients · sidebar-closed | iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--patients--sidebar-closed.png) |
| `tap.under-44` | owner · patients · sidebar-closed | iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--patients--sidebar-closed.png) |
| `tap.under-44` | practitioner · patients · sidebar-closed | iPad 1194 | 1200 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--patients--sidebar-closed.png) |
| `tap.under-44` | owner · performance · sidebar-closed | iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--performance--sidebar-closed.png) |
| `tap.under-44` | patient · portal-appointments · sidebar-closed | iPad 1194 | 8 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-appointments--sidebar-closed.png) |
| `tap.small-link` | patient · portal-billing · sidebar-closed | iPad 1194 | 1 text link shorter than 24px (wide enough to hit, but thin). — e.g. button.cursor-pointer.font-semibold.underline "message your clinic" 115×20 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-billing--sidebar-closed.png) |
| `tap.under-44` | patient · portal-billing · sidebar-closed | iPad 1194 | 4 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-billing--sidebar-closed.png) |
| `tap.under-44` | patient · portal-clinic · sidebar-closed | iPad 1194 | 11 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-clinic--sidebar-closed.png) |
| `tap.under-44` | patient · portal-home · sidebar-closed | iPad 1194 | 18 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-home--sidebar-closed.png) |
| `tap.under-44` | patient · portal-journal · sidebar-closed | iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-journal--sidebar-closed.png) |
| `tap.under-44` | patient · portal-plan · sidebar-closed | iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-plan--sidebar-closed.png) |
| `tap.under-44` | patient · portal-records · sidebar-closed | iPad 1194 | 45 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-records--sidebar-closed.png) |
| `tap.under-44` | patient · portal-resources · sidebar-closed | iPad 1194 | 6 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-resources--sidebar-closed.png) |
| `tap.under-44` | patient · portal-routine · sidebar-closed | iPad 1194 | 23 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-routine--sidebar-closed.png) |
| `tap.under-44` | patient · portal-settings · sidebar-closed | iPad 1194 | 8 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-settings--sidebar-closed.png) |
| `tap.under-44` | patient · portal-timeline · sidebar-closed | iPad 1194 | 12 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/patient--portal-timeline--sidebar-closed.png) |
| `tap.under-44` | admin · profile · sidebar-closed | iPad 1194 | 23 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--profile--sidebar-closed.png) |
| `tap.under-44` | front_desk · profile · sidebar-closed | iPad 1194 | 24 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--profile--sidebar-closed.png) |
| `tap.under-44` | owner · profile · sidebar-closed | iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--profile--sidebar-closed.png) |
| `tap.under-44` | practitioner · profile · sidebar-closed | iPad 1194 | 29 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--profile--sidebar-closed.png) |
| `tap.small-link` | owner · retention · sidebar-closed | iPad 1194 | 137 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.text-foreground.underline-offset-4.hover:underline "Miss Adele Nethercombe" 167×20 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--retention--sidebar-closed.png) |
| `tap.under-44` | owner · retention · sidebar-closed | iPad 1194 | 306 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--retention--sidebar-closed.png) |
| `tap.small-link` | admin · schedule-day · sidebar-closed | iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 303×15 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--schedule-day--sidebar-closed.png) |
| `tap.small-link` | front_desk · schedule-day · sidebar-closed | iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 303×15 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--schedule-day--sidebar-closed.png) |
| `tap.small-link` | owner · schedule-day · sidebar-closed | iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 303×15 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--schedule-day--sidebar-closed.png) |
| `tap.small-link` | practitioner · schedule-day · sidebar-closed | iPad 1194 | 10 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.relative.mt-1.block "Zara Haddad" 303×15 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--schedule-day--sidebar-closed.png) |
| `tap.under-44` | admin · schedule-day · sidebar-closed | iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--schedule-day--sidebar-closed.png) |
| `tap.under-44` | front_desk · schedule-day · sidebar-closed | iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--schedule-day--sidebar-closed.png) |
| `tap.under-44` | owner · schedule-day · sidebar-closed | iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--schedule-day--sidebar-closed.png) |
| `tap.under-44` | practitioner · schedule-day · sidebar-closed | iPad 1194 | 33 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--schedule-day--sidebar-closed.png) |
| `tap.under-44` | owner · schedule-month · sidebar-closed | iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--schedule-month--sidebar-closed.png) |
| `tap.small-link` | owner · schedule-week · sidebar-closed | iPad 1194 | 128 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.inline-flex.items-center.text-left "09:15–10:00" 67×16 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--schedule-week--sidebar-closed.png) |
| `tap.under-44` | owner · schedule-week · sidebar-closed | iPad 1194 | 83 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--schedule-week--sidebar-closed.png) |
| `tap.under-44` | owner · settings · sidebar-closed | iPad 1194 | 368 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--settings--sidebar-closed.png) |
| `tap.under-44` | owner · team-member · sidebar-closed | iPad 1194 | 34 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--team-member--sidebar-closed.png) |
| `tap.small-link` | admin · team · sidebar-closed | iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 744×20 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--team--sidebar-closed.png) |
| `tap.small-link` | front_desk · team · sidebar-closed | iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 1108×20 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--team--sidebar-closed.png) |
| `tap.small-link` | owner · team · sidebar-closed | iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara OseiYou" 496×22 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--team--sidebar-closed.png) |
| `tap.small-link` | practitioner · team · sidebar-closed | iPad 1194 | 4 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Amara Osei" 1108×20 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--team--sidebar-closed.png) |
| `tap.under-44` | admin · team · sidebar-closed | iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/admin--team--sidebar-closed.png) |
| `tap.under-44` | front_desk · team · sidebar-closed | iPad 1194 | 13 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/front_desk--team--sidebar-closed.png) |
| `tap.under-44` | owner · team · sidebar-closed | iPad 1194 | 75 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/owner--team--sidebar-closed.png) |
| `tap.under-44` | practitioner · team · sidebar-closed | iPad 1194 | 13 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/ipad-pro-landscape/practitioner--team--sidebar-closed.png) |

</details>

<details><summary>Overlays, dialogs and tabs (92)</summary>

| Probe | Where | Devices | Detail | Shot |
| --- | --- | --- | --- | --- |
| `tap.small-link` | admin · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--account-menu.png) |
| `tap.small-link` | front_desk · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--account-menu.png) |
| `tap.small-link` | owner · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--account-menu.png) |
| `tap.small-link` | practitioner · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 11 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--account-menu.png) |
| `tap.under-44` | admin · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 126 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--account-menu.png) |
| `tap.under-44` | front_desk · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 76 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--account-menu.png) |
| `tap.under-44` | owner · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 125 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--account-menu.png) |
| `tap.under-44` | practitioner · dashboard · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 55 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--account-menu.png) |
| `tap.under-44` | owner · dashboard · alert-team | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 5 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button#alert-target.flex.h-9.w-full "Owners & managers" 301×36 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--alert-team.png) |
| `tap.small-link` | admin · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--bell.png) |
| `tap.small-link` | front_desk · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--bell.png) |
| `tap.small-link` | owner · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--bell.png) |
| `tap.small-link` | practitioner · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 11 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--bell.png) |
| `tap.under-44` | admin · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 120 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--bell.png) |
| `tap.under-44` | front_desk · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 72 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--bell.png) |
| `tap.under-44` | owner · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 121 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--bell.png) |
| `tap.under-44` | practitioner · dashboard · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 51 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--bell.png) |
| `tap.small-link` | owner · dashboard · dock-alerts | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 23 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-alerts.png) |
| `tap.under-44` | owner · dashboard · dock-alerts | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 128 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-alerts.png) |
| `tap.small-link` | owner · dashboard · dock-chat | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-chat.png) |
| `tap.under-44` | owner · dashboard · dock-chat | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 121 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-chat.png) |
| `tap.small-link` | owner · dashboard · notes | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--notes.png) |
| `tap.under-44` | owner · dashboard · notes | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 140 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--notes.png) |
| `tap.small-link` | owner · dashboard · quick-book | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 text links shorter than 24px (wide enough to hit, but thin). — e.g. button.text-left.text-xs.font-medium "09:00 – 09:45" 79×12 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--quick-book.png) |
| `tap.under-44` | owner · dashboard · quick-book | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 128 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--quick-book.png) |
| `tap.small-link` | admin · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.hover:text-foreground.hover:underline "07798 142505" 81×16 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--today-card-detail.png) |
| `tap.small-link` | front_desk · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.hover:text-foreground.hover:underline "07798 142505" 81×16 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--today-card-detail.png) |
| `tap.small-link` | owner · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.hover:text-foreground.hover:underline "07798 142505" 81×16 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--today-card-detail.png) |
| `tap.small-link` | practitioner · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 2 text links shorter than 24px (wide enough to hit, but thin). — e.g. a.hover:text-foreground.hover:underline "07798 142505" 81×16 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--today-card-detail.png) |
| `tap.under-44` | admin · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button.inline-flex.min-h-6.cursor-pointer "Complete" 87×24 | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--today-card-detail.png) |
| `tap.under-44` | front_desk · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button.inline-flex.min-h-6.cursor-pointer "Complete" 87×24 | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--today-card-detail.png) |
| `tap.under-44` | owner · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 17 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button.inline-flex.min-h-6.cursor-pointer "Complete" 87×24 | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--today-card-detail.png) |
| `tap.under-44` | practitioner · dashboard · today-card-detail | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button.inline-flex.min-h-6.cursor-pointer "Complete" 87×24 | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--today-card-detail.png) |
| `tap.small-link` | owner · offers · offer-automation | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1 text link shorter than 24px (wide enough to hit, but thin). — e.g. button.text-xs.font-semibold.text-accent-ink "Show 79 skipped" 98×16 | [local](../../test-results-responsive/shots/iphone-se/owner--offers--offer-automation.png) |
| `tap.under-44` | owner · offers · offer-automation | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. input#offer-delay.flex.h-9.w-full 293×36 | [local](../../test-results-responsive/shots/iphone-se/owner--offers--offer-automation.png) |
| `tap.under-44` | owner · offers · offer-editor | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 21 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button.absolute.right-2.top-2 "Close" 32×32 | [local](../../test-results-responsive/shots/iphone-se/owner--offers--offer-editor.png) |
| `tap.under-44` | owner · patient-record · record-treatment | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 9 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. select#catalogue_id.h-10.w-full.rounded-xl "Skin Consultation — ConsultationFollow-u" 293×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--record-treatment.png) |
| `tap.under-44` | owner · patient-record · send-form | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 4 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. select#kind.h-10.w-full.rounded-xl "Consent formConsultation formTreatment p" 293×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--send-form.png) |
| `tap.under-44` | owner · patient-record · send-offer | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 5 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. select#offer-template[data-qc=send-offer-template].h-10.w-full.rounded-xl "Autumn skin reset · One-off · Compliment" 293×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--send-offer.png) |
| `tap.under-44` | admin · patient-record · tab-contact | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 31 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--tab-contact.png) |
| `tap.under-44` | front_desk · patient-record · tab-contact | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 31 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--tab-contact.png) |
| `tap.under-44` | owner · patient-record · tab-contact | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 32 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-contact.png) |
| `tap.under-44` | practitioner · patient-record · tab-contact | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 31 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--tab-contact.png) |
| `tap.under-44` | admin · patient-record · tab-documents | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--tab-documents.png) |
| `tap.under-44` | front_desk · patient-record · tab-documents | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--tab-documents.png) |
| `tap.under-44` | owner · patient-record · tab-documents | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 28 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-documents.png) |
| `tap.under-44` | practitioner · patient-record · tab-documents | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--tab-documents.png) |
| `tap.under-44` | owner · patient-record · tab-history | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 27 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-history.png) |
| `tap.under-44` | owner · patient-record · tab-photos | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 31 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-photos.png) |
| `tap.under-44` | owner · patient-record · tab-portal | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 26 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-portal.png) |
| `tap.under-44` | owner · patient-record · treatment-form | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 14 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[data-qc=form-page-1].flex.min-w-0.flex-1 "1Before you start" 68×32 | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--treatment-form.png) |
| `tap.under-44` | owner · patients · bulk-select | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1201 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--patients--bulk-select.png) |
| `tap.under-44` | patient · portal-home · account-menu | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--account-menu.png) |
| `tap.under-44` | patient · portal-home · bell | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 18 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--bell.png) |
| `tap.under-44` | patient · portal-home · portal-ai | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 24 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--portal-ai.png) |
| `tap.under-44` | patient · portal-home · portal-chat | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--portal-chat.png) |
| `tap.under-44` | patient · portal-journal · journal-new | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 22 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-journal--journal-new.png) |
| `tap.under-44` | patient · portal-timeline · pause-modal | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 16 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/patient--portal-timeline--pause-modal.png) |
| `tap.small-link` | owner · schedule-day · new-booking | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1 text link shorter than 24px (wide enough to hit, but thin). — e.g. button.text-xs.text-accent-ink.hover:underline "+ New patient" 81×16 | [local](../../test-results-responsive/shots/iphone-se/owner--schedule-day--new-booking.png) |
| `tap.under-44` | owner · schedule-day · new-booking | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 16 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. select#patient_id.flex.h-9.w-full "Select patientGrace AdeyemiJonas Ashbury" 322×36 | [local](../../test-results-responsive/shots/iphone-se/owner--schedule-day--new-booking.png) |
| `tap.under-44` | owner · team · invite-staff | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 10 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. input#_r_1b_-form-item.flex.h-9.w-full 303×36 | [local](../../test-results-responsive/shots/iphone-se/owner--team--invite-staff.png) |
| `tap.small-link` | owner · team · tab-former | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 1 text link shorter than 24px (wide enough to hit, but thin). — e.g. a.block.text-sm.font-medium "Dr Helen Cho" 301×20 | [local](../../test-results-responsive/shots/iphone-se/owner--team--tab-former.png) |
| `tap.under-44` | owner · team · tab-former | iPhone 375, iPhone 393, iPad 768, iPad 1194 | 15 tap targets between 24 and 43px (Apple HIG recommends 44). — e.g. button[aria-label=Open sidebar].inline-flex.items-center.justify-center 40×40 | [local](../../test-results-responsive/shots/iphone-se/owner--team--tab-former.png) |
| `type.small` | admin · dashboard · account-menu | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--account-menu.png) |
| `type.small` | front_desk · dashboard · account-menu | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--account-menu.png) |
| `type.small` | owner · dashboard · account-menu | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--account-menu.png) |
| `type.small` | practitioner · dashboard · account-menu | iPhone 375, iPhone 393 | 2 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--account-menu.png) |
| `type.small` | admin · dashboard · bell | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--dashboard--bell.png) |
| `type.small` | front_desk · dashboard · bell | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--dashboard--bell.png) |
| `type.small` | owner · dashboard · bell | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--bell.png) |
| `type.small` | practitioner · dashboard · bell | iPhone 375, iPhone 393 | 2 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--dashboard--bell.png) |
| `type.small` | owner · dashboard · dock-alerts | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-alerts.png) |
| `type.small` | owner · dashboard · dock-chat | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--dock-chat.png) |
| `type.small` | owner · dashboard · notes | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--notes.png) |
| `type.small` | owner · dashboard · quick-book | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span[data-qc=claimed-offer-chip][aria-label=Offer claimed].inline-flex.h-6.shrink-0 "Offer" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--dashboard--quick-book.png) |
| `type.small` | owner · offers · offer-editor | iPhone 375, iPhone 393 | 5 text elements between 10 and 11px on a phone. — e.g. button.flex.h-[4.5rem].flex-col "Background" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--offers--offer-editor.png) |
| `type.small` | admin · patient-record · tab-contact | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--tab-contact.png) |
| `type.small` | front_desk · patient-record · tab-contact | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--tab-contact.png) |
| `type.small` | owner · patient-record · tab-contact | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-contact.png) |
| `type.small` | practitioner · patient-record · tab-contact | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--tab-contact.png) |
| `type.small` | admin · patient-record · tab-documents | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/admin--patient-record--tab-documents.png) |
| `type.small` | front_desk · patient-record · tab-documents | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/front_desk--patient-record--tab-documents.png) |
| `type.small` | owner · patient-record · tab-documents | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-documents.png) |
| `type.small` | practitioner · patient-record · tab-documents | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/practitioner--patient-record--tab-documents.png) |
| `type.small` | owner · patient-record · tab-history | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-history.png) |
| `type.small` | owner · patient-record · tab-photos | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-photos.png) |
| `type.small` | owner · patient-record · tab-portal | iPhone 375, iPhone 393 | 10 text elements between 10 and 11px on a phone. — e.g. span.ml-1.5.inline-flex.h-[15px] "2" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--tab-portal.png) |
| `type.small` | owner · patient-record · treatment-form | iPhone 375, iPhone 393 | 3 text elements between 10 and 11px on a phone. — e.g. span.grid.h-5.w-5 "1" 10.0px | [local](../../test-results-responsive/shots/iphone-se/owner--patient-record--treatment-form.png) |
| `type.small` | patient · portal-home · account-menu | iPhone 375, iPhone 393 | 11 text elements between 10 and 11px on a phone. — e.g. p.mt-1.5.line-clamp-2.break-words "Consultation & consent" 10.5px | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--account-menu.png) |
| `type.small` | patient · portal-home · bell | iPhone 375, iPhone 393 | 11 text elements between 10 and 11px on a phone. — e.g. p.mt-1.5.line-clamp-2.break-words "Consultation & consent" 10.5px | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--bell.png) |
| `type.small` | patient · portal-home · portal-ai | iPhone 375, iPhone 393 | 11 text elements between 10 and 11px on a phone. — e.g. p.mt-1.5.line-clamp-2.break-words "Consultation & consent" 10.5px | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--portal-ai.png) |
| `type.small` | patient · portal-home · portal-chat | iPhone 375, iPhone 393 | 20 text elements between 10 and 11px on a phone. — e.g. p.mt-1.5.line-clamp-2.break-words "Consultation & consent" 10.5px | [local](../../test-results-responsive/shots/iphone-se/patient--portal-home--portal-chat.png) |

</details>

## Touch interactions (WebKit projects)

| Check | Page | Device | Outcome | Note |
| --- | --- | --- | --- | --- |
| `checkin-slider-drag` | portal-plan | iPhone SE 375 | **works** | Slider moved 30 → 85. Track height 34px. |
| `checkin-slider-drag` | portal-plan | iPhone 15 393 | **works** | Slider moved 30 → 84. Track height 34px. |
| `checkin-slider-drag` | portal-plan | iPad Mini 768 | **works** | Slider moved 100 → 81. Track height 34px. |
| `checkin-slider-drag` | portal-plan | iPad Pro 1194 | **works** | Slider moved 100 → 81. Track height 34px. |
| `routine-complete-tap` | portal-routine | iPhone SE 375 | **works** | Tapped "Mark as complete"; control now reads "Completed". |
| `routine-complete-tap` | portal-routine | iPhone 15 393 | **works** | Tapped "Mark as complete"; control now reads "Completed". |
| `routine-complete-tap` | portal-routine | iPad Mini 768 | **not-present** | Today's step is already complete (an earlier device in this run tapped it). |
| `routine-complete-tap` | portal-routine | iPad Pro 1194 | **not-present** | Today's step is already complete (an earlier device in this run tapped it). |
| `settings-switch-tap` | portal-settings | iPhone SE 375 | **works** | Toggled by tap; switch is 36×24px. |
| `settings-switch-tap` | portal-settings | iPhone 15 393 | **works** | Toggled by tap; switch is 36×24px. |
| `settings-switch-tap` | portal-settings | iPad Mini 768 | **works** | Toggled by tap; switch is 36×24px. |
| `settings-switch-tap` | portal-settings | iPad Pro 1194 | **works** | Toggled by tap; switch is 36×24px. |
| `portal-chat-tap` | portal-home | iPhone SE 375 | **works** | Chat opened; the message box is inside the viewport. |
| `portal-chat-tap` | portal-home | iPhone 15 393 | **works** | Chat opened; the message box is inside the viewport. |
| `portal-chat-tap` | portal-home | iPad Mini 768 | **works** | Chat opened; the message box is inside the viewport. |
| `portal-chat-tap` | portal-home | iPad Pro 1194 | **works** | Chat opened; the message box is inside the viewport. |
| `diary-carousel-next-tap` | dashboard | iPhone SE 375 | **works** | The strip advanced on tap. |
| `diary-carousel-next-tap` | dashboard | iPhone 15 393 | **works** | The strip advanced on tap. |
| `diary-carousel-next-tap` | dashboard | iPad Mini 768 | **works** | The strip advanced on tap. |
| `diary-carousel-next-tap` | dashboard | iPad Pro 1194 | **works** | The strip advanced on tap. |
| `diary-carousel-swipe` | dashboard | iPhone SE 375 | **tap-alternative** | Drag did not scroll; Next / Previous buttons exist. |
| `diary-carousel-swipe` | dashboard | iPhone 15 393 | **tap-alternative** | Drag did not scroll; Next / Previous buttons exist. |
| `diary-carousel-swipe` | dashboard | iPad Mini 768 | **tap-alternative** | Drag did not scroll; Next / Previous buttons exist. |
| `diary-carousel-swipe` | dashboard | iPad Pro 1194 | **tap-alternative** | Drag did not scroll; Next / Previous buttons exist. |
| `stage-menu-tap` | dashboard | iPhone SE 375 | **works** | Tapping the stage badge opens the journey menu. |
| `stage-menu-tap` | dashboard | iPhone 15 393 | **works** | Tapping the stage badge opens the journey menu. |
| `stage-menu-tap` | dashboard | iPad Mini 768 | **works** | Tapping the stage badge opens the journey menu. |
| `stage-menu-tap` | dashboard | iPad Pro 1194 | **works** | Tapping the stage badge opens the journey menu. |
| `today-card-dialog-tap-close` | dashboard | iPhone SE 375 | **works** | Opened and closed by tap. |
| `today-card-dialog-tap-close` | dashboard | iPhone 15 393 | **works** | Opened and closed by tap. |
| `today-card-dialog-tap-close` | dashboard | iPad Mini 768 | **works** | Opened and closed by tap. |
| `today-card-dialog-tap-close` | dashboard | iPad Pro 1194 | **works** | Opened and closed by tap. |
| `dock-chat-tap` | dashboard | iPhone SE 375 | **works** | Inbox opens and closes by tap. |
| `dock-chat-tap` | dashboard | iPhone 15 393 | **works** | Inbox opens and closes by tap. |
| `dock-chat-tap` | dashboard | iPad Mini 768 | **works** | Inbox opens and closes by tap. |
| `dock-chat-tap` | dashboard | iPad Pro 1194 | **works** | Inbox opens and closes by tap. |
| `sidebar-resize-drag` | dashboard | iPhone SE 375 | **not-present** | Sidebar is closed. |
| `sidebar-resize-drag` | dashboard | iPhone 15 393 | **not-present** | Sidebar is closed. |
| `sidebar-resize-drag` | dashboard | iPad Mini 768 | **not-present** | Sidebar is closed. |
| `sidebar-resize-drag` | dashboard | iPad Pro 1194 | **tap-alternative** | The 4px resize handle cannot be dragged by finger; Close / Open sidebar buttons exist. On phones the sidebar should not be resizable at all. |
| `diary-drag-reschedule` | schedule | iPhone SE 375 | **tap-alternative** | A drag over 90px did not move the block by touch; the appointment dialog's time editor is the alternative. |
| `diary-drag-reschedule` | schedule | iPhone 15 393 | **tap-alternative** | A drag over 90px did not move the block by touch; the appointment dialog's time editor is the alternative. |
| `diary-drag-reschedule` | schedule | iPad Mini 768 | **tap-alternative** | A drag over 90px did not move the block by touch; the appointment dialog's time editor is the alternative. |
| `diary-drag-reschedule` | schedule | iPad Pro 1194 | **tap-alternative** | A drag over 90px did not move the block by touch; the appointment dialog's time editor is the alternative. |
| `day-planner-horizontal-scroll` | schedule | iPhone SE 375 | **untestable** | The planner is wider than the screen. A mouse drag does not pan a scroll container and this harness cannot emulate a touch pan; the scroller has edge shadows and no touch-action lock, so finger panning is expected to work. Verify on a device. |
| `day-planner-horizontal-scroll` | schedule | iPhone 15 393 | **untestable** | The planner is wider than the screen. A mouse drag does not pan a scroll container and this harness cannot emulate a touch pan; the scroller has edge shadows and no touch-action lock, so finger panning is expected to work. Verify on a device. |
| `day-planner-horizontal-scroll` | schedule | iPad Mini 768 | **untestable** | The planner is wider than the screen. A mouse drag does not pan a scroll container and this harness cannot emulate a touch pan; the scroller has edge shadows and no touch-action lock, so finger panning is expected to work. Verify on a device. |
| `day-planner-horizontal-scroll` | schedule | iPad Pro 1194 | **not-present** | The planner fits without sideways scroll at this width. |
| `record-tab-tap` | patient-record | iPhone SE 375 | **works** | Tabs switch by tap. |
| `record-tab-tap` | patient-record | iPhone 15 393 | **works** | Tabs switch by tap. |
| `record-tab-tap` | patient-record | iPad Mini 768 | **works** | Tabs switch by tap. |
| `record-tab-tap` | patient-record | iPad Pro 1194 | **works** | Tabs switch by tap. |

## Runtime errors during the visit

None recorded on any base capture.

## Redirects and skipped states

Pages a role could not open (redirected by the access gate): practitioner → team-member.

States whose trigger was not on screen (recorded, not failed):

- owner · dashboard · consent-in-clinic — Desktop 1920, iPad Mini 768, iPad Pro 1194, iPhone 15 393, iPhone SE 375, Laptop 1366, Laptop 1440
- admin · dashboard · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- admin · patient-record · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- admin · patients · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- admin · profile · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- admin · schedule-day · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- admin · team · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · dashboard · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · patient-record · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · patients · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · profile · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · schedule-day · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- front_desk · team · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · dashboard · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · insights · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · insights-book · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · offers · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · patient-record · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · patients · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · patients-board · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · performance · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · profile · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · retention · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · schedule-day · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · schedule-month · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · schedule-week · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · settings · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · team · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- owner · team-member · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-appointments · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-billing · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-clinic · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-home · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-journal · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-plan · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-records · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-resources · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-routine · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-settings · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- patient · portal-timeline · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · dashboard · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · patient-record · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · patients · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · profile · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · schedule-day · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375
- practitioner · team · sidebar-closed — iPad Mini 768, iPhone 15 393, iPhone SE 375

## How to re-run

```
npm run test:responsive            # all 7 projects, matrix + touch checks
npx playwright test --config playwright.responsive.config.ts --project iphone-se -g "owner · dashboard"
node scripts/responsive-report.mjs --captures   # rebuild this report and refresh docs/responsive/captures
```
