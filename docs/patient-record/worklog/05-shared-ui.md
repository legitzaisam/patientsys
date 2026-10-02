# Phase 5: shared UI pieces

Branch `e2e_exp`, on top of `23c946d`. 2 Oct 2026. The building blocks every redesigned tab uses, built on the existing primitives and tokens only (no new colours; every value maps to `src/styles.css`). New folder `src/components/patients/record/`.

### pr-p5-01-record-card

- `record-card.tsx` → `RecordCard({ icon, tone, title, meta, children, footer })`: `glass-card`, padding `20px 22px 16px`, a header with the 30px / radius-10 icon tile (`shadow-inset-hi`), a 15px/500 title and right-hand meta in `--ink-2`, the body, and a footer pinned to the bottom with `mt-auto` behind a `--edge-2` hairline that can wrap. Tile tones: `success` (Skin plan), `sky` (Upcoming), `warning` (Tasks and recalls), `journal` (aftercare pink), `accent`. Accepts `data-*` hooks for the specs.
- Exported with it: `recordLinkClass` — the footer's text-only actions ("Open roadmap →", "Reply in chat"): accent ink, 12.5px/500, underline on hover, no background and no outline, as the hand-off insists; and `recordRowClass` — the white-wash row with a hairline and 16px radius used inside the cards.

### pr-p5-02-chips

- `chips.tsx` → `ToneChip({ tone })`: `padding 1px 9px`, pill, 11px/500. Tones: `alert` (destructive-bg / destructive-ink: Balance due, Deposit unpaid, Not booked, Depth not recorded), `review` (warning-bg / warning-ink: Consent due, Chase booking), `done` (success), `sky` (dates, Recall, N photos), `current` (accent 50% / accent-ink: In progress), `upcoming` (white 80% + hairline / ink-2), `neutral` (transparent, dashed `rgba(70,85,122,.35)`: Not on skin plan), `journal` (aftercare 30% / aftercare-ink: Day 4), `moderate` (noshow-bg / noshow-ink).
- `TabBadge({ count, tone })`: renders nothing at 0; `pink` is the 18px circle (`rgba(250,204,226,.7)`, `--destructive-ink`, 10.5px/600) for Medical history and From the patient; `gold` is the bare accent-ink figure Treatments already used.

### pr-p5-03-severity

- `severity-bars.tsx` → `SeverityBars({ redness, sensitivity, dryness })`: three `72px 1fr 62px` rows, 6px track `rgba(192,200,210,.42)`, fill `--destructive` / `--noshow` / `--success` by `severityLabel`, the word beside it bold for Severe and Moderate; `role="meter"` with the reading. `SeverityWord` on its own for the All check-ins table. `severityTone()` lives in `src/lib/patients/record-overview.ts` (a component file may only export components under the fast-refresh rule).

### pr-p5-04-payment-chip

- `src/components/payments/payment-status-chip.tsx` (new) holds `PaymentStatusChip`, moved out of `src/routes/_authenticated/schedule.tsx` (L1087–1310) with its behaviour intact: the chip + hover card with Receipt / Balance outstanding / Payment outstanding, deposit or full amount, Email / Text through `sendPaymentRequest`. Two additions for the record: a `trigger` prop that replaces the chip as the hover-card trigger (the Ready to treat row's "Take payment" text link), an `align` prop, and `data-qc="payment-card"` on the content. The `a` prop is typed (`PaymentChipAppointment`) instead of `any`.
- `schedule.tsx` imports it; its own copy is deleted and the now-unused `sendPaymentRequest` import removed. `Mail`, `Phone`, `CreditCard`, `HoverCard*`, `formatMoney` stay because the booking dialog and consent chip still use them. Checked on the rebuilt local stack: the diary's Paid chip opens "Receipt · Chemical Peel · #4 · Paid in full £150.00 · Email · Text" as before.

### pr-p5-05-worklog-05

- Gates: `tsc` no new errors, per-hunk eslint 0 on all five files, unit 272 passed with the 11 known failures. Nothing consumes the new pieces yet; Phases 6–9 do.
