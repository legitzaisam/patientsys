# Phase 5: Diary

Branch `e2e_live`, on top of `5b5c044`. 27 Sep 2026.

## Scope

Index bullets 012 (tap popover), 033 (colour key), 034 (Needs action control), 035 (now line, already present), 042 / 144 (clinic time), 043 (own diary), 044 (details-incomplete chip). Source for 034: `Claude outputs/diary-status-filter-mockup.html`.

## Changes

### Needs action (034)

- `src/components/schedule/needs-action.ts` (pure): `needsActionTypes(flags)` maps the shared `appointmentFlags` onto the menu's five types, keeping Unpaid and Deposit due apart (a booking ahead of its day owes a deposit; on or after the day it is unpaid); `summariseNeedsAction(rows, { nowMs, depositLeadDays })` → per-appointment types, counts (`any` + five) and `matches(id, selection)`; `useNeedsAction` (memo on the minute tick); `needsActionHint`; `needsActionCardClass` (match ring / fade `.28` + `saturate(.3)`).
- `src/components/schedule/needs-action-control.tsx`: the pill (`data-qc="needs-action"`, `data-state`), main button (`needs-action-main`, `needs-action-count`), caret (`needs-action-caret`) opening a Popover menu (`needs-action-menu`, items `needs-action-item-any|unpaid|deposit_due|consent_due|running_late|details_incomplete`, zero counts disabled, ✓ on the selection, footer linking to the dashboard), Clear (`needs-action-clear`), and the green "All clear" (`needs-action-all-clear`) at zero. `NeedsActionTags` renders the tag chips on a matching card. Menu is full width on phones.
- `schedule.tsx`: one selection shared by the day and week planners; the control sits left of View by on the header row; a hint line (`needs-action-hint`) appears under the header while anything is outstanding or a filter is on. Day cards carry `data-needs-action="match|faded"`, the ring/fade class and the tags (a matching card grows to 100 px so the tags fit); week cards the same via a `needsAction` prop; month cells show only a rose count (`month-needs-action-count`). `useMinuteTick` refreshes "running late". Deposit lead days come from `getClinicDetails`.
- `src/lib/metrics/appointment-flags.ts`: `deposit_due` now applies only to bookings ahead of today (`days > 0`); `NEEDS_ACTION_TYPES` is `as const` with a `NeedsActionType` union. Unit test added for the on-the-day case.

### Colour key (033)

`src/components/schedule/colour-key.tsx` (`data-qc="colour-key"`) under the day and week timetables: one swatch per treatment name in view, using `toneForTreatment` with the manager's overrides, so it matches the cards exactly.

### Own diary (043), tap popover (012), clinic time (042 / 144), chip (044)

- `schedule.tsx`: a practitioner (not manager) is seeded onto their own column once identity loads; "All practitioners" stays one click away.
- `ChipRow` (the status glyphs on diary cards) is a controlled HoverCard: a tap on touch (`pointerType === "touch"` or `(hover: none)`) toggles it; pointer-down on the glyphs no longer starts a drag.
- `clinic-time.ts`: `clinicDayRangeForKey(key)` and `clinicMinutesOfDay(at)`; production `getPractitionerDay` uses both. The demo twin keeps local time because its fixtures build the day in local time (see the note in the demo dashboard).
- `DetailsIncompleteChip` on day and week cards (`schedule.tsx`) and on dashboard diary cards (`today-snapshot.tsx`), `data-qc="details-incomplete-chip"`; hidden while the card shows Needs action tags (which already include it).

### Tests

- `e2e/schedule.spec.ts`: three new tests — the control (counts, ring/fade, menu items and counts, narrowing to a type, Clear, colour key), week control + month counts, practitioner own-column default.
- `e2e/responsive/pages.ts`: `needs-action-open` state on `schedule-day` (core, every role) and `schedule-week`.

## Verification

| Check                | Result                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                 | 153 / 153 (flags test extended)                                                                                                                            |
| tsc                  | 103 (baseline 103)                                                                                                                                         |
| Lint                 | New files clean; `schedule.tsx` +38 prettier indentation findings inherited from the pre-existing mis-indented JSX blocks the new lines sit in (kept consistent with their surroundings rather than reformatting ~1,000 lines) |
| e2e                  | schedule 6 / 6, smoke and feedback-corrections green except the pre-existing `:126`; `reminders:10` and `treatment-workflow:63` pre-existing               |
| Responsive (schedule + dashboard, all devices) | green after two fixes found by the gate: Clear became a 28 px tap target, the menu is full width on phones                                       |

## Captures

Day planner with the menu open and "Everything outstanding" (6 of 10) highlighted; a matching card with "Unpaid" and "Consent due" tags; the rest faded in place. `/tmp/pf-p5-day-*.png` during the run.

## Notes

- Running late counts depend on the real clock in the demo (the fixture's "now" is the machine's now on the diary), so the menu's "Running late" count varies through the day; the e2e reads counts from the control rather than hard-coding them.
- The dashboard's Attention list still derives its deposit items on the server (Phase 4); Phase 8 aligns its copy with the same lead-day rule.
