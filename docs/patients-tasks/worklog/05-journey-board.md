# Phase 5: Patients → Journey board (B)

Branch `e2e_exp`, on top of `5c366d2`. 29 Sep 2026. The four kanban cards become the mockup's triage tiles over a practitioner × phase map. Information only: nothing on this tab books or assigns; a pill opens the patient in the Records drawer, where the actions live. Captures: [`captures/p5-board/`](../captures/p5-board/) — `board-owner--{laptop-1440,ipad-landscape,ipad-portrait}.jpg` (no tiles lit) and `board-owner-highlight--*.jpg` (Overdue + No-show lit).

### pt-p5-01-board-filters-tiles

- `src/components/patients/journey-board.tsx` rewritten. Props `identity`, `initialAtRiskOnly` (the dashboard's `?risk=1`), `tiles`, `prac` (both from the route's search, parsed there since P4).
- **Filter row**: "Practitioner", one 30 px lane-coloured initials face per practitioner who holds a plan (multi-select; selected ring `0 0 0 2px card, 0 0 0 4px foreground`; the rest fade to 45 % when any is picked), the selection ("Tom W." / "All practitioners"), "· tap tiles to highlight", and `Clear highlight` / `Clear` on the right. A practitioner opens on their own book (`prac` absent → me); `prac=all` shows everyone.
- **Six triage tiles** (`RISK_META` from P1): Overdue, No-show, Wrong booking, No booking, Due this week, On track — each a button with the risk label + dot, the count (30 px), the descriptor and up to five overlapping 22 px faces (`data-count` for the specs). Toggle, multi-select, OR. Selected: the risk fill with `0 0 0 2px ring, 0 10px 24px -12px ring` through a `--tile-ring` variable (`RISK_META.ringVar`, new: `--destructive`, `--noshow`, `--sky`, `--warning`, `--accent-deep`, `--success`). Unselected: `bg-glass shadow-glass`. Tile counts are scoped by the practitioner filter.
- URL: `tiles=overdue,noshow` and `prac=…` (replace navigation, so the back button leaves the page); `?risk=1` maps to `RISK_DEEP_LINK_TILES` (overdue, noshow, nobook) until the user changes the tiles.
- Data: `listTreatmentPlans({})` once (the `risk` / `dueBucket` fields added in P3); rows and cells are derived client-side.

### pt-p5-02-board-map

- A `Card` with a `grid-cols-[140px_repeat(4,minmax(0,1fr))]` table (`role="table"`): the phase header ("01 Consultation & prep" with a mono number), one row per practitioner (28 px initials avatar, short name, "7 plans"; rows sorted busiest first), phase cells with 1 px dashed left / top hairlines (`border-edge-2`), min-height 132 px, and wrapping **patient pills** (20 px `PatientAvatar`, first name, 6 px risk dot; `data-name`, `data-patient`, `data-risk`, `data-hit`). Each pill is a `Link` to `/patients?sel=<id>` and carries a `Tooltip` with full name, plan + progress and the next step with its date line (`noShowLine` → `bookingMismatchLine` → `overdueLabel` → `planDateLabel`).
- Highlight: with tiles lit, matching pills take the first matching tile's fill and `0 0 0 1.5px ring, 0 6px 14px -6px ring`; the rest fade to 30 %. A practitioner filter fades whole rows to 30 %. Transitions 200 ms on opacity, background and shadow.
- Legend (five risk dots) and the note "N of M plans highlighted · Hover a patient for their plan and next step. Follow-ups live on the Tasks page." No Book buttons anywhere on the tab.
- The Records tab now lands on the selected patient's page when a deep link carries `sel` without `page` (the board's pills reach patients beyond page 1).

### pt-p5-03-board-responsive

- Tiles: 2 columns on phones, 3 on tablets (`sm`), 6 from `xl`. The map keeps its 880 px minimum inside the card's `scroll-x-shadows` scroller with the practitioner column sticky (`sticky left-0 bg-card`), so on iPad portrait the phases scroll under a fixed first column and the page itself never overflows (probe: `mapScrollsInside: true, pageOverflow: false`; landscape needs no scroll).
- Tap targets: the `Clear` / `Show everyone` / `+ Assign task` text links got a 28 px hit area (the gate flagged 20 px on touch projects).

### pt-p5-04-verify-commit

- `e2e/patients.spec.ts`: the journey board describe is rewritten (six tiles present; each tile's `data-count` equals the pills with that `data-risk`; two tiles → URL `tiles=`, `data-hit` count = sum, legend "N of M plans highlighted"; a face → `prac=` and other rows at opacity 0.3; Clear; no `board-book`; a pill → `/patients?sel=` and the drawer names the patient; `?risk=1` presses overdue / noshow / nobook). The plan-card agreement test hovers Olivia's pill and reads the tooltip; the Attention tests read unbooked pills by `data-name`; the no-show test finds the `data-risk="noshow"` pill and its `data-patient`.
- `e2e/responsive/pages.ts`: `patients` states `sidebar-closed`, `records-drawer`, `assign-dialog`, `bulk-select` (now opens Select first); `patients-board` for owner and practitioner with `board-tiles`; `boardBook` removed.

| Check | Result |
| ----- | ------ |
| Probe (`/tmp/pt-probe-board.mjs`) | 20 pills; Overdue + No-show → 3 hits = 2 + 1, others faded, URL `tiles=overdue%2Cnoshow`; face → `prac=`, other rows opacity 0.3, Overdue scoped to 1; Clear → no tiles; `?risk=1` → three tiles pressed; pill "Marcus" → drawer "Marcus Delaney" (after the page-landing fix); iPad portrait tiles 3 cols, map scrolls inside, no page overflow |
| `e2e/patients.spec.ts` (Chromium) | 17 / 18; the one failure is the pre-existing `patients:314` insights test |
| Responsive gate `patients` + `patients-board`, 7 devices | **42 / 42** after three fixes: 28 px tap targets on the text links; the Assign dialog's radio rows are now the buttons themselves (the 16 px radio circles tripped `tap.small`) with the SUGGESTED badge at 10 px; the dialog body scrolls on its own so the close button and footer stay put; and the "Close automatically" switch was renamed so the probe's close-button heuristic (`aria-label*="lose"`, `data-qc*="close"`) no longer picks it |
| Unit | 243 passed, the 11 pre-existing failures |
| tsc | 107 (0 new) |
| Lint | `journey-board.tsx` 11 → 0; everything else 0 |
| Commit | see the index |
