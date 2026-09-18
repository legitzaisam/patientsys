---
name: Month planner redesign
overview: Rebuild the month planner cells around the day/week visual language — treatment-tinted event pills, count badges, and a hover peek listing the full day — replacing the flat grey time+name pills and fixing the empty-day alignment bug.
todos:
  - id: month-cells
    content: "Rebuild month cell: header row (day number + week-style count badge), up to 3 treatment-tinted pills, +N more, top-aligned flex layout, empty-day hover wash"
    status: completed
  - id: month-peek
    content: "HoverCard day peek: header with date + count, read-only week-style mini cards (tone wash, name link, treatment, practitioner, status glyphs), Open day action"
    status: completed
  - id: month-verify
    content: Playwright verification (peek opens, Open day navigates, Sunday alignment fixed, zero console errors) + tsc delta and lints
    status: completed
  - id: month-commit
    content: Commit to patient0 and push with Zaisam's token
    status: in_progress
isProject: false
---

# Month planner: congruent redesign

All changes live in `MonthView` (and small new helpers) in [src/routes/_authenticated/schedule.tsx](src/routes/_authenticated/schedule.tsx) (L2273–2363). No server or data changes.

## Problems today

- Cells show up to three flat grey pills with only "time + First L." — no treatment, practitioner, or status; "+N more" is dead text hiding most of the day.
- Empty cells (e.g. Sundays, clinic closed) render the day number vertically centred — browsers centre `<button>` content by default; the cell button needs `flex flex-col` top alignment.
- No treatment colour language, unlike the day and week planners which share `diary-event` cards tinted via `toneForTreatment` (L1836, L2228).

## Cell design (hybrid, congruent with week)

- Header row inside each cell: day number left (today keeps the accent circle), and the same count badge the week day-header uses (L2163: `size-6 rounded-full bg-[rgba(47,63,102,0.08)] tabular-nums`).
- Body: up to 3 compact event pills, each tinted with `toneForTreatment(a.treatment_name, treatmentColours)` — tone wash background, tone-text time, patient "First L." in foreground, truncated. Same colours as the day/week cards, so a month cell reads as a miniature of the week column.
- Overflow: muted "+N more" text (the peek carries the rest).
- Cell button becomes `flex h-full flex-col items-stretch` (fixes the centred-number bug); empty in-month days get the week planner's hover wash (`bg-[rgba(47,63,102,0.06)]`) as the "open this day" cue; outside-month days keep `opacity-40`.
- Click on the cell keeps jumping to the day planner via the existing `onPick(day)`.

## Day peek on hover

- Wrap each cell in the existing `HoverCard` (openDelay ~280ms / closeDelay ~140ms, matching L829 usage): content is a `w-80` panel, `max-h-[60vh] overflow-y-auto`.
- Peek header: "Fri 18 Sept · 7 booked"; body: one read-only mini card per appointment mirroring `WeekAppointmentCard` (L2220) — tone wash, time range, patient name linking to the record, "treatment · #n", practitioner line, and static consent/paid glyphs (reusing the chip icons without the interactive `ChipRow`, which opens nested popovers that would fight the hover card).
- Footer: an "Open day" button calling `onPick(day)`.

## Verification

- `tsc` delta against the baseline plus lints.
- Playwright pass against `npm run dev:demo`: month view screenshot; hover a busy day → peek lists all appointments; "Open day" lands on that date in the day planner; empty Sunday cells show a top-aligned day number; zero console/page errors.
- Commit to `patient0` and push with Zaisam's token (URL push, keychain untouched), consistent with the previous tasks.