# Tasks page QC: the three role views, pagination, alignment

Branch `e2e_exp`, on top of `f042fdf`. 29 Sep 2026. A review asked whether the Tasks page really has the three views from the mock (C1 owner / manager, C2 practitioner, C3 front desk), for the Whole team list to be paginated, and for an alignment audit. Captures: [`captures/qc-tasks/`](../captures/qc-tasks/) — `before-tasks-{owner,practitioner,front_desk}--{laptop-1440,ipad-landscape,ipad-portrait}.jpg` and the matching `after-*`, plus `after-tasks-owner-page2--laptop-1440.jpg` (a whole card with the pager) and `after-tasks-owner-full--ipad-portrait.jpg` (header, nav row, ten rows, pager, Team rail).

## Audit

| Question | Finding |
| -------- | ------- |
| Do the three views exist? | Yes. The view is keyed by who is signed in (`taskRole(identity)`), as the hand-off specifies ("the Viewing as switcher in the mock exists for the demo only; in the app the role comes from `useIdentity()`"). Owner: My tasks · Whole team · Unassigned · Front desk pool · Created by rules · Done today, Team rail, checkboxes, Delegate / Reassign. Practitioner: Assigned to me · Clinical questions · My patients, with others · Done today, Your day rail, Done… / Hand to front desk. Front desk: My queue · Front desk pool · Retries due today · Done today, Today's calls rail, Claim / Log outcome…, no clinical questions anywhere. |
| Why did they look missing? | In the demo the only way to change persona was the floating "Demo: Clinic owner" pill bottom-left, so a reviewer signed in as the owner saw one view and no switcher on the page. |
| Whole team list | 58 rows in one card, 9,300 px tall at 1440; on an iPad in portrait the Team rail sat 9,000 px down. |
| Alignment | Rows are one CSS grid so every column already lined up; two defects: in the practitioner nav "My patients, with others" pushed its count out of the 190 px column (clipped on every device), and at 1440 the type chips wrap into a 5 + 1 split under the title (inherent at that card width; left as is). |

## Changes

- **"Viewing as" pill, demo only** (`tasks.tsx`, `DEMO_MODE` gate): Owner / manager · Practitioner · Front desk in the page header to the left of `New task`, the standard segmented-pill markup, `aria-pressed` on the current persona. Picking one sets the `demo_role` cookie and reloads through `switchDemoRole()` — the same code the floating switcher uses, moved to `src/lib/demo/switch-role.ts` so both can import it (the `react-refresh/only-export-components` rule forbids exporting it from the component file). In production the pill does not render; the role still comes from the login.
- **Pagination, ten a page** (`tasks.tsx`): `page` in the URL (absent for page 1); the shared `PaginationBar` under the list ("Showing 11–20 of 58 tasks · Page 2 of 6"), hidden when everything fits. Rows are sliced from the server's grouped order, so a page can start inside a group — the header then reads "Overdue · 19 · continued" with the group's total, never the slice. Changing view, type chips or person starts on page 1; a `?task=` deep link lands on that task's page, scrolls it into view and highlights it (the cleanup navigation that drops `task` from the URL passes `resetScroll: false`, otherwise the router's `scrollToTopSelectors` undid the scroll). Rows now read each task from the optimistically patched flat list, so a handled row leaves the page at once instead of on the refetch.
- **Nav label wrap** (`tasks-side-panels.tsx`): in the desktop column a view button is `h-auto min-h-9 whitespace-normal`, the label `min-w-0`, the count `shrink-0`; "My patients, with others" wraps to two lines the way the C2 mock draws it and the count stays.

## Verification

| Check | Result |
| ----- | ------ |
| Alignment probe (`/tmp/pt-align.mjs`), 4 scenes × 3 devices | every row column has one x per page (1440: select 497 · avatar 533 · title 581 · assignee 955 · due right 1097); group headers = row left edge (491); pager caption / buttons on the rows' inner text edges (501 / 1097); nav, list and rail tops all 130 at 1440; header pill and New task centred on the same line (81); no horizontal overflow on any device |
| `e2e/tasks.spec.ts` | 9 / 9 — two new tests: pagination (page in URL, "continued", view / chip resets, no pager under ten rows, deep link → page 3 in viewport) and the Viewing as pill (owner → practitioner → front desk → owner, each landing on its default view and rail) |
| `patients`, `patients-records`, `retention`, `feedback-corrections` | only the recorded pre-existing failures; `retention` walks the pages to find the hand-off's recall task |
| Responsive gate `major`, `tasks` × 3 roles, 7 devices | 28 / 28 |
| tsc / lint | 106 (0 new) / `new-by-line 0` on the five files touched |
