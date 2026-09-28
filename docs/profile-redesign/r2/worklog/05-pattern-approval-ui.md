# Phase 5: pattern approval UI and the Requests to approve chip

Branch `e2e_live`, on top of `332bbdc`. 29 Sep 2026.

Captures: [`captures/p5-pattern-approval/`](../captures/p5-pattern-approval/) — `p5-self-editor.jpg` (Nadia proposing new Thursday hours with a note), `p5-self-pending.jpg` (the pending banner), `p5-manage-proposal.jpg` (the owner's Proposed change panel and the "Working pattern · pending" row), `p5-dashboard-owner-chip.jpg` (Requests to approve, four rows).

### r2-p5-01-self-editor-send-for-approval

- `working-pattern-card.tsx` rewritten around one editor for every mode. `direct` = manage mode, or the owner / software admin on their own page → the button reads `Edit hours` (`pattern-edit`) and the footer `Save hours` (`pattern-save`, `setWorkingPattern`). Anyone else on their own page gets `Request a change` (`pattern-request-change`) → the same editor (TimeFields, Day off / Add hours), a butter note "New hours go to your manager / the clinic owner for approval; the diary follows once they agree.", an optional reviewer note (`pattern-note`), the live weekly total and `Send for approval` (`pattern-request-send`, `requestWorkingPatternChange({ rows, note })`). The submit button is disabled while the draft equals the current pattern (`samePattern`). The old note-only dialog is gone — the request now carries the hours.
- The card takes `viewer`, `request` and `hasSeparateManager` from `ScheduleTab`, which reads `patternRequest` from `useStaffSchedule`; `staff-profile-page.tsx` passes them through. `PatternRequestView` added to `profile-types.ts`.

### r2-p5-02-pending-banner-withdraw

- While a request is pending on the self page: the header button becomes `Change requested ✓` (`pattern-change-requested`, disabled) and a glass banner (`pattern-pending`) shows "Change requested · awaiting your manager" (or "the clinic owner" for a `requires_owner` request or a clinic without a separate manager), the note, a `ChangeList` of only the days that differ (`pattern-change-row`: "Thu 12:00–17:00 (was 12:00–20:00)") and `Withdraw` (`pattern-request-withdraw` → `withdrawWorkingPatternChange`). The bars underneath still show the current hours.
- Every mutation invalidates `staff-schedule`, `staff-profile/<id>`, `my-profile`, `staff-notifications` and `dashboard`.

### r2-p5-03-manage-proposal-approve-decline

- Manage mode with a pending request: a butter panel (`pattern-proposal`) "Proposed change from Nadia", the note, the same day comparison, and `Approve` (`pattern-approve` → `reviewWorkingPatternChange(approve: true)`) / `Decline` (`pattern-decline` → dialog with an optional reason `pattern-decline-note`, `pattern-decline-confirm`). A `requires_owner` request seen by a manager shows "Only the clinic owner can decide this one." instead of the buttons. `Edit hours` stays available (a direct save supersedes the request server-side).
- `time-off-cards.tsx`: the requests card lists the pending pattern request first as "Working pattern · <summary>" with the status chip (`pattern-request-row`), and the empty state accounts for it. The pending time-off row's text block now has `min-w-[12rem]`, so on a 320 px column the Approve / Decline controls wrap under the text instead of squeezing the dates into a two-word column (the P0 capture showed "Fri / 30 / Oct" stacked).

### r2-p5-04-attention-chip

- `attention-list.tsx`: `CHIP_META.staff_request = { label: "Requests to approve", className: "bg-accent-soft text-accent-ink" }`, placed after `profile_change` in `KIND_ORDER`; `personKey` keys `staff_request` rows by id so every request is its own row; rail tone `bg-accent`. Rows link to `/team/<id>?tab=schedule` (the `href` from the server item).

### r2-p5-05-verify-commit

| Flow (demo, Chromium 1440) | Result |
| -------------------------- | ------ |
| Practitioner | `Request a change` → editor, Send disabled until a change; Thursday end 17:00 + note → `Sent for approval`; banner "Change requested · awaiting your manager", one change row, button `Change requested ✓`, requests card row "Working pattern · Thu 12:00–17:00 (was 12:00–20:00) · pending"; bars still 12:00–20:00; dashboard has no chip |
| Owner dashboard | chip `Requests to approve` (4): Nadia — pattern, Tom — pattern (fixture), Nadia — time off, Sofia — time off; every row links to the person's Schedule tab |
| Manager dashboard | the same four (key on) |
| Owner on Nadia | proposal panel with the note and the change row; `Approve` → panel gone, Thursday reads 12:00–17:00 |
| Owner on Tom | `Decline` with a reason → panel gone, Saturday unchanged |
| Practitioner again | Thursday 12:00–17:00 applied, button back to `Request a change`; new request (Tuesday on) → pending → `Withdraw` → banner gone |
| Manager's own | banner reads "awaiting the clinic owner"; the owner's dashboard lists "Maya Chen · Fri Off (was 09:00–17:30)" |
| Front desk on Nadia | no Working pattern card at all (Front desk layout) |
| `e2e/profile-redesign.spec.ts` + `profile-governance` + `team` | 17 / 17 |
| tsc / lint | 109 / delta 0 on `working-pattern-card.tsx`, `schedule-tab.tsx`, `time-off-cards.tsx`, `profile-types.ts`, `staff-profile-page.tsx`, `attention-list.tsx` |

Files: `src/components/profile/working-pattern-card.tsx`, `schedule-tab.tsx`, `time-off-cards.tsx`, `profile-types.ts`, `staff-profile-page.tsx`, `src/components/dashboard/attention-list.tsx`; captures under `captures/p5-pattern-approval/`.
