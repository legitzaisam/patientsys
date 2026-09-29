# Phase 1: themed time and date pickers

Branch `e2e_live`, on top of `d61d85d`. 29 Sep 2026. The native `<input type="time">` / `<input type="date">` (the grey boxy Chrome dropdown in the screenshot) are replaced on the profile by two reusable primitives that type like a text field and pick from a glass popover in the app's idiom.

Captures: [`captures/p1-pickers/`](../captures/p1-pickers/) — `p1-time-picker-{phone,tablet,desktop}.jpg` (owner editing Nadia's Thursday end, hour 17 picked), `p1-date-picker-{phone,tablet,desktop}.jpg` (practitioner's "I've renewed", November 2027 with the 13th selected).

### r2-p1-01-parsers

- `src/lib/field-parse.ts` (new, pure): `normaliseClock` ("9", "9:5", "0930", "930", "9.30", "5pm", "5:30 pm", "12am" → `HH:MM`; null for "25:00", "9:75", words), `clockOptions(step, from, to)` inclusive, `parseDayInput` ("13/11/2027", "13-11-2027", "13.11.27", "2027-11-13", "13 Nov 2027", "13 November 2027" → `YYYY-MM-DD`; impossible dates null), `formatDayInput` (`13/11/2027`), `dayKeyToDate` (local noon, DST-safe) and `dateToDayKey`.
- `tests/unit/field-parse.test.ts`: 7 tests, all green. One fix on the way: the meridiem match is anchored at the end (`5pm` has no word boundary between the digit and the letters).

### r2-p1-02-time-field

- `src/components/ui/time-field.tsx` (new): `TimeField({ id, value, onChange, minHour = 6, maxHour = 22, disabled, "data-qc" })`. The `Input` keeps the given `data-qc` (so `fill("10:00")` in the specs still works), `inputMode="numeric"`, normalises on blur and Enter, `aria-invalid` + destructive border on unreadable input. A clock button (`<qc>-open`) toggles a `Popover` anchored to the field: `rounded-[20px] bg-glass-2 shadow-inset-hi`, two columns — hours 06–22 in a scroll-without-scrollbar column (`.scroll-y-plain`, new utility in `styles.css`; the selected hour scrolls to centre on open) and minutes :00 / :15 / :30 / :45 — items `h-9 rounded-xl`, selected `bg-foreground text-background font-bold`, hover `rgba(47,63,102,0.08)`. Picking an hour keeps the minute (or :00); picking a minute closes. `data-qc="time-picker"`, `time-hour-HH`, `time-minute-MM`.

### r2-p1-03-date-field

- `src/components/ui/date-field.tsx` (new): `DateField({ id, value, onChange, min, max, disabled, "data-qc" })`. Same shell as the time field (text input showing `13/11/2027`, calendar button `<qc>-open`, `aria-invalid`), popover with the existing `ui/calendar.tsx` (react-day-picker 9) — `mode="single"`, `locale={enGB}`, `weekStartsOn={1}`, `min` / `max` as `disabled` matchers — restyled through `classNames` and a custom `DayButton`: days `h-9 w-9 rounded-xl`, selected `bg-foreground text-background`, today `ring-1 ring-foreground/40`, outside days `text-ink-3`, round glass nav buttons. Typing ISO or UK forms both parse (the round-1 spec's `fill(YYYY-MM-DD)` keeps working), out-of-range typed dates are marked invalid, picking closes. `data-qc="date-picker"`, day buttons carry `data-day="YYYY-MM-DD"`.

### r2-p1-04-wire-pattern-editor

- `working-pattern-card.tsx`: the editor's start / end use `TimeField` with `data-qc="pattern-start-<wd>"` / `pattern-end-<wd>` on the input; `Input` import dropped. Values flow as `"HH:MM" | null` straight into `setDraftRow`.
- Checked: typed `930` + Enter → `09:30`; `99:99` + Tab → `aria-invalid="true"`; picker on Thursday end → hour 17 → `17:00`, minute :30 → `17:30` and the popover closes; weekly total recalculates (36.5 h); page `scrollWidth` = viewport at 390 / 820 / 1440.

### r2-p1-05-wire-registration-insurance

- `registration-insurance-card.tsx`: "I've renewed" date → `DateField` (`registration-renew-date`, `min={todayKey}`), insurance "Valid until" → `DateField` (`insurance-expiry-date`); `[&_input]:bg-card` keeps the white field on the tinted well.
- `e2e/profile-redesign.spec.ts`: the renew step targets `registration-renew-date` and presses Enter (the `input[type="date"]` selector no longer exists).
- Checked: typing `2027-11-13` + Enter shows `13/11/2027`; calendar opens on November 2027, Monday-first ("Mo"), the 13th selected; picking the 20th writes `20/11/2027` and closes.

### r2-p1-06-verify-commit

| Check | Result |
| ----- | ------ |
| Probe (Chromium, phone / tablet / desktop) | both pickers open, pick, close, normalise and flag invalid input; no horizontal overflow; no console errors |
| `e2e/profile-redesign.spec.ts` + `e2e/profile-governance.spec.ts` | 12 / 12 |
| Unit | `field-parse` 7 / 7 |
| tsc | 109 = baseline |
| Lint | delta 0 on `time-field.tsx`, `date-field.tsx`, `working-pattern-card.tsx`, `registration-insurance-card.tsx`, `field-parse.ts`, the test |

Files: `src/lib/field-parse.ts`, `src/components/ui/time-field.tsx`, `src/components/ui/date-field.tsx`, `tests/unit/field-parse.test.ts` (new); `src/components/profile/working-pattern-card.tsx`, `src/components/profile/registration-insurance-card.tsx`, `src/styles.css` (`.scroll-y-plain`), `e2e/profile-redesign.spec.ts`; captures under `captures/p1-pickers/`.

Left as they were, per the plan's non-goals: the native time / date inputs in quick add, the diary, the patient record and the period picker.

## Revised (after manual review)

**Reported:** the popovers "didn't seem to be working" when tried by hand.

**Found:** they opened and picked correctly (Playwright, Chromium + WebKit, through the live 8099 gateway), but the panel was invisible. The `PopoverContent` `className` replaced the default `bg-popover` surface with translucent `bg-glass-2`, so the hour/minute digits and the calendar floated straight over the table rows underneath.

**Fix:** keep the solid popover surface on the content (`border-edge-2 bg-card`) and put the glass on an inner well (`rounded-2xl bg-glass-2 p-1 shadow-inset-hi`) around the columns / the calendar.

**Proof:** `07-time-popover-revised.png`, `08-date-popover-revised.png` (Chromium via gateway); `profile-r2.spec.ts` pickers 2/2; responsive gate iPhone SE / iPhone 15 / laptop 6/6; tsc 109 (0 new); lint delta 0.
