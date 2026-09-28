# Phase 7: Performance & earnings

Branch `e2e_live`, on top of `5de3792`. 28 Sep 2026. The earnings tab is now one calendar month at a time, laid out as the mockup (`B-Performance.dc.html`): stepper and actions, four KPI cards, daily bars, the grouped table, four small tiles; and the invoice dialog (`B-Invoice.dc.html`) with the live preview. Every money figure is the person's share per treatment from `getMyEarnings`, so the cards, the bars, the table footer and the CSV reconcile.

Captures: [`captures/p7-earnings/`](../captures/p7-earnings/) — `p7-earnings-practitioner.jpg`, `p7-earnings-by-treatment.jpg`, `p7-earnings-owner-on-nadia.jpg`, `p7-invoice-dialog.jpg` (current month), `p7-invoice-dialog-sent.jpg` (August, paid), `p7-invoice-done.jpg`, `p7-phone-earnings.jpg`.

### p7-01-month-stepper

- `src/components/profile/earnings-tab.tsx` (new): `EarningsTab({ mode, subject, todayKey, onInvoice })`. Round Previous / Next buttons (`earnings-prev-month`, `earnings-next-month`; Next disabled on the current month, Previous stops eleven months back), the month name (`earnings-month`) and the note (`earnings-month-note`) from `monthNote()` in `profile-helpers.ts`: "1–28 Sep · month in progress" for the current month; for a past one "Invoice sent · paid 5 Sep" / "Invoice sent 1 Sep" / "Invoice scheduled for 1 Oct" / "No invoice yet" from `listPractitionerInvoices`. Actions: `Export CSV` (`earnings-export-csv`, disabled with no lines; file `earnings-YYYY-MM.csv` via `earningsCsv` + `downloadText`, both moved into `profile-helpers.ts` from the old `toCsv`) and, on the self page only, `Create & send invoice` (`earnings-invoice`) which opens the dialog on the month being viewed.
- Data: `getMyEarnings` for the month's clinic-time range (`userId` in manage mode), query key `["my-earnings", "self" | userId, from, to]` shared with the Month-so-far card.
- Checked: probe — September "1–28 Sep · month in progress", August "Invoice sent · paid 5 Sep"; CSV download `earnings-2026-08.csv`; the owner on Nadia gets Export but no invoice button.

### p7-02-kpis-chart

- KPI cards (`Card p-5`): Your / Their earnings (`metric:earnings.share`, 30 px, hint "Your share at 45% of treatments delivered" keeping `earnings-rate`), Collected (`metric:earnings.collected`, "Bookings marked paid"), Outstanding (`metric:earnings.outstanding`, destructive ink when > 0, "Unpaid or deposit only"), Treatments (`metric:earnings.treatments`, "£103.86 average value").
- Daily earnings card: header + the selected-day well (`bg-accent-soft`, `earnings-day-detail`, `metric:earnings.day`: "Mon 28 Sep · £612.00 · 5 treatments · £135.00 outstanding" / "all collected"); bars from `dailyEarnings(lines, year, month)` — a day with earnings is a button (`earnings-bar`, `bg-foreground`, selected `bg-accent`, height ∝ share, `aria-pressed`), a day without is a 4 px stub, a future day a dashed outline; axis 1 · 8 · 15 · 22 · last day. The last worked day is selected by default; the selection resets on month change.
- Checked: 27 bars in September (28 in August), clicking the first August bar selects "Sat 1 Aug £704.25 · 6 treatments · all collected".

### p7-03-table-tiles

- Earnings table card: title + the standard pill group `By day` / `By month` / `By treatment` (`earnings-group-<key>`). Columns: Date · Treatments · Earned · Outstanding (day; outstanding in destructive ink, "—" when none), Month · Treatments · Earned · Invoice (month; Paid / Sent / Scheduled / Not sent from the invoice list), Treatment · Treatments · Earned · Share of earnings (percent of the month). Grouping via `groupLinesByDay` / `groupLinesByMonth` / `groupLinesByTreatment` (P2). By month runs a second `getMyEarnings` over the six months ending at the selected one (`enabled` only for that grouping). Footer "<Month> total" / "Last 6 months" with `metric:earnings.table.total`. Hairlines use `border-edge-2` (`--edge` is white and invisible on a card).
- Bottom tiles: Patients seen (`metric:earnings.patients`), New patients (`metric:earnings.newPatients`), Attendance (`metric:earnings.attendance`), Retention (`metric:earnings.retention`) — all from the same month query.
- Checked: probe — By month "September 2026 · 133 · £13,812.75 · Not sent", "August 2026 · 123 · £14,604.75 · Paid" (reconciles with the fixture invoice), then four earlier months; By treatment "Brow Tattoo 9 £1,507.50 11%" first; footer total £13,812.75 = the Your earnings card.

### p7-04-invoice-dialog

- `src/components/profile/invoice-dialog.tsx` (new): `InvoiceDialog({ open, onOpenChange, subject, todayKey, initial })`, `DialogContent max-w-[1000px] md:grid-cols-[380px_minmax(0,1fr)]`. Left pane: Invoice period buttons — current month and previous month, plus the month the tab was on if different, suffixed "· sent" / "· scheduled" (`invoice-period-YYYY-MM`); notes — in progress (`invoice-note-progress`, "September isn’t over yet. Schedule it for 1 Oct and it will include every day of the month."), already sent (`invoice-note-sent`, "August was sent on 1 Sep and paid on 5 Sep. You can download a copy."), scheduled (`invoice-note-scheduled`); Send to radio cards Payroll team (clinic email from `getClinicDetails`) / Clinic owner ("To their SQINOS inbox and email") (`invoice-recipient-<id>`); Note textarea (`invoice-note`). Buttons: current month → `Schedule to send on 1 Oct` (default, `invoice-schedule`) + `Send now` (`invoice-send-now`) + `Download PDF` (`invoice-download`, `window.print()`); past unsent month → Send now + Download PDF; already sent → Download PDF only. Done state (`invoice-done`) with the check disc, "Scheduled for 1 Oct" / "Invoice sent", the explanatory line and `Done` (`invoice-done-close`). `useUnsavedChanges` guards navigation while a note is typed.
- Right pane (hidden under `md`): the preview (`invoice-preview`) — `BrandMark` + INVOICE, number `INV-NR-2026-09` (`invoice-number`, or the stored number once one exists), Issued (send date for the current month, today for a past one, the real `sent_at` once sent) and Due (+14 days), From (name, job title, email), Bill to (clinic name, recipient, email), the line "Treatments delivered, practitioner share · 1–30 September 2026" with qty (`invoice-qty`) and amount (`invoice-amount`; the stored amount and count for a sent invoice, otherwise the live `getMyEarnings` figures), Adjustments £0.00, Total due (`invoice-total`), footer "Generated by SQINOS from completed treatments in the diary."
- Submits `createPractitionerInvoice({ year, month, recipient, note, mode })` and invalidates `practitioner-invoices` and `staff-notifications`.
- `staff-profile-page.tsx`: hoists `{ open, period }` for the dialog; the hero's `Create & send invoice`, the Month-so-far card's `Create <Month> invoice` and the tab's button all open it (the tab passes its month). Mounted on the self page for people who treat.
- Checked: probe — August preselected from the tab: "August · sent", `INV-NR-2026-08`, 123 / £14,604.75, only Download PDF; September: `INV-NR-2026-09`, 133 / £13,812.75, progress note, both recipients, Schedule / Send now / Download PDF; chose Clinic owner + a note, Schedule → "Scheduled for 1 Oct · We’ll send it to the clinic owner on 1 Oct with the final September figures. You can change it until then."; reopening from the hero shows the scheduled note.

### p7-05-verify-commit

| Check | Result |
| ----- | ------ |
| Render probe (demo) | practitioner self (September, August, groupings, bar pick, CSV, dialog flows), owner on Nadia (manage + commission: full tab, no invoice button), front desk on Nadia with `?tab=earnings` → falls back to Overview, phone 390 px `scrollWidth` 390 |
| tsc | 109 = after P6, no new errors |
| Lint | delta 0 on `earnings-tab.tsx`, `invoice-dialog.tsx`, `staff-profile-page.tsx`, `profile-helpers.ts`, `profile-types.ts` |
| Console | no page or console errors in any probe |

Files: `src/components/profile/earnings-tab.tsx`, `src/components/profile/invoice-dialog.tsx` (new); `src/components/profile/staff-profile-page.tsx`, `profile-helpers.ts` (`shortDate`, `earningsCsv`, `downloadText`, `monthNote`), `profile-types.ts` (`EarningsLine`, `InvoiceRowLike`); captures under `captures/p7-earnings/`.

Left for later: `e2e/feedback-corrections.spec.ts:276` (old "Your performance" heading, `payout-summary`, `earnings-print`) is rewritten against this tab in P10; `earnings/practitioner-earnings.tsx` and `earnings-lines-table.tsx` are retired in P9 now that nothing on the profile renders them.
