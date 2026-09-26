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
