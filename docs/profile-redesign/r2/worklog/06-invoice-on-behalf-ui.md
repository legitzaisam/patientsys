# Phase 6: invoice on behalf UI

Branch `e2e_live`, on top of `9282728`. 29 Sep 2026. The Overview's blue Month-so-far card, the hero and the earnings tab offer Create invoice on a colleague's page for viewers who hold Set staff commission (the owner and software admin always), and the dialog raises it for that person.

Captures: [`captures/p6-invoice-on-behalf/`](../captures/p6-invoice-on-behalf/) — `p6-overview-owner-nadia.jpg` (the blue card with `Create September invoice`, the hero with `Create & send invoice`), `p6-invoice-dialog-owner-on-nadia.jpg` ("Built from Nadia’s completed treatments.").

### r2-p6-01-buttons-manage-mode

- `staff-profile-page.tsx`: `canInvoice = showEarnings && !subject.revoked`, where `showEarnings` is already "the subject treats and (own page or `viewer.canCommission`)". Passed to `ProfileHero` (`canInvoice`), `MonthSoFarCard` (`canInvoice`) and `EarningsTab` (`canInvoice`); each renders its button on that flag instead of `mode === "self"`. Labels unchanged: "Create & send invoice", "Create September invoice". The hero shows the invoice button above "Add time off" in manage mode.
- `InvoiceDialog` is mounted whenever `canInvoice`, with `mode`.

### r2-p6-02-dialog-subject-aware

- `invoice-dialog.tsx` takes `mode`. In manage mode the invoice list and the month's earnings are fetched with `userId: subject.userId` (query keys keyed by the subject, so they share the earnings tab's cache), `createPractitionerInvoice` carries `userId`, the number comes from the subject's initials (`INV-NR-…` for Nadia) and the description reads "Built from Nadia’s completed treatments." The From block is the subject as before.

### r2-p6-03-done-copy-and-invalidation

- Done-state copy for on-behalf: "We’ll send it to the payroll team on 1 Oct with the final September figures. Nadia has been told." / "The payroll team has Nadia’s September invoice. Nadia has been told; mark it paid here once it is settled." Own-page copy unchanged. Success invalidates `practitioner-invoices` (all subjects) and `staff-notifications`.
- A manager without `team.commission` has no earnings tab, no Month-so-far card and no invoice buttons (they never had the earnings surface); the front desk has none either.

### r2-p6-04-verify-commit

| Probe (demo) | Result |
| ------------ | ------ |
| Owner on Nadia | hero + `Create September invoice`; dialog "Built from Nadia’s completed treatments.", `INV-NR-2026-09`, From Dr Nadia Rahman, 133 / £13,812.75, periods September / August · sent; Schedule → "Scheduled for 1 Oct … Nadia has been told."; earnings tab has `earnings-invoice` |
| Nadia | her own buttons unchanged; notification "Dr Amara Osei scheduled your September 2026 invoice · £13,812.75 · to payroll on 1 Oct 2026." |
| Manager, `team.commission` on | both buttons |
| Manager, `team.commission` off (owner toggles) | no buttons, no Month-so-far card, no earnings tab, still `profile-page-manage`; toggled back on afterwards |
| Front desk | no buttons |
| tsc / lint | 109 / delta 0 on `invoice-dialog.tsx`, `profile-hero.tsx`, `overview-side-cards.tsx`, `earnings-tab.tsx`, `staff-profile-page.tsx` |

Files: `src/components/profile/invoice-dialog.tsx`, `profile-hero.tsx`, `overview-side-cards.tsx`, `earnings-tab.tsx`, `staff-profile-page.tsx`; captures under `captures/p6-invoice-on-behalf/`.
