# Clinic diary — planner redesign

Rebuild the day planner around calm clinic colours (ivory grid, deep teal ink, sage/teal blocks), time down the left, practitioners across the top — with drag-to-reschedule, quick add, and ADHD-friendly focus. The red "now" line is removed.

## What changes

**No red line.** The current time is shown as a soft tinted band across the row plus a small "now" pill in the time gutter — present, not alarming.

**Collapsed empty hours.** Long stretches with no bookings collapse into a thin "3 quiet hours" strip you can click to expand. The grid starts at the first booking, not 05:00.

**Now / Next strip.** A slim band above the grid: what's happening right now and what's next per practitioner, with patient name, treatment, and one status chip. This is the visual anchor.

**Colour by practitioner.** Each practitioner gets a stable accent hue drawn from the clinic palette (teal, sage, sand, slate, plum). Column header, avatar ring, and block edge share that hue so lanes are readable at a glance.

**Minimal chips.** Each block shows time, patient, treatment. Consent/payment/stage collapse into up to two small dot-icons; the full set appears on hover, with existing hover actions unchanged.

**Drag to reschedule.** Drag a block vertically to change time, or across columns to change practitioner. Snaps to 5-minute steps, shows a live time ghost while dragging, and asks for confirmation before saving. Rescheduling keeps existing behaviour (stage resets to booked, notifications sent). Escape cancels a drag. Blocks stay keyboard-accessible with a fallback hover time editor.

**Quick add — both routes.**
- Click or drag on empty grid space opens a compact popover pre-filled with that practitioner and time slot: patient search, treatment, duration, Book. Hovering empty space shows a faint "+" cue.
- A slim quick-add bar sits in the planner header: patient, treatment, time, practitioner, Book — always available without opening the full dialog.

**Design polish.** Wider gutter with lighter hour rules and no half-hour lines, rounded 12px blocks with a coloured left edge, hover lift, softer column headers with per-practitioner booking counts and free-time total.

## Design options

After approval I'll render three variants of this planner to pick from before finalising:
1. **Soft lanes** — airy grid, pastel practitioner tints, generous spacing.
2. **Card rails** — stronger column separation with card-style lanes and bolder headers.
3. **Focus deck** — compact grid with a prominent Now/Next deck and heavier collapsing of quiet time.

## Technical notes

- All work in `src/routes/_authenticated/schedule.tsx` plus new components: `day-planner.tsx`, `quick-add-popover.tsx`, `now-next-strip.tsx`, `practitioner-colours.ts`.
- Drag handled with pointer events and slot maths (no new drag library); reuses the existing `rescheduleAppointment` server function.
- Practitioner accent hues added as tokens in `src/styles.css` (no hardcoded colours in components).
- Quick add reuses the existing booking server function, including the new-patient path.
- Week/month views unchanged this round.
