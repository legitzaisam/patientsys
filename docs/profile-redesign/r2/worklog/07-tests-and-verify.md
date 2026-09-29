# Phase 7: tests, full verification, stitching re-run, after-captures, docs

Branch `e2e_live`, on top of `9423a49`. 29 Sep 2026. Code committed as `83c9669`; this worklog, the README and the after-captures follow in the docs commit. Not pushed.

### r2-p7-01-e2e-new

- `e2e/profile-r2.spec.ts` (new, 8 tests, green alone and in the full run):
  - pickers — the time field normalises `930` → `09:30`, flags `99:99` (`aria-invalid`), the popover picks hour 17 then :30 and closes; the date field on "I've renewed" shows `13/11/2027` from ISO input, opens on November 2027 with `Mo` first, picks the 20th and closes.
  - earnings tab — `earnings-tiles` precede `earnings-daily` which precede `earnings-table`; the dialog shows the number, issued date and total; Download PDF (with `window.print` stubbed) sets `body[data-printing="invoice"]` and the title to the number, under `emulateMedia({ media: "print" })` the sheet is the only visible child of `<body>`, and `afterprint` clears the attribute.
  - working-pattern approval — practitioner: Send disabled until a change, Thursday to 17:00 with a note → banner "awaiting your manager", one change row, `Change requested ✓`, the "Working pattern" row in the requests card, bars still 12:00–20:00, no dashboard chip; owner: `Requests to approve` chip with Nadia and Tom, the Nadia row leads to `/team/<nadia>?tab=schedule`, the proposal panel carries the note, Approve → Thursday 12:00–17:00; practitioner: applied, new request → withdraw; the owner then restores Thursday to 12:00–20:00 so the shared in-memory clinic is left as the fixture had it. Also: the owner declines Tom's fixture request with a reason (Saturday unchanged), a manager's own change reads "awaiting the clinic owner", the front desk sees no card, no invoice button and no chip.
  - invoice on behalf — owner on Nadia: hero button, `Create <Month> invoice` on the blue card, dialog "Built from Nadia’s completed treatments.", From Dr Nadia Rahman, `INV-NR-…`, Schedule → "Nadia has been told", the earnings tab keeps its invoice button.

### r2-p7-02-e2e-updates

- `e2e/profile-redesign.spec.ts` (round 1): the owner's earnings-tab assertion flips to `earnings-invoice` count 1 (the owner may raise it since P6); the current-month dialog step accepts the progress note or the scheduled note (another spec may already have scheduled the month); the renew-date step targets `registration-renew-date` (P1).
- `e2e/profile-governance.spec.ts`: the owner's Attention test also asserts the `Requests to approve` chip.
- `e2e/responsive/pages.ts`: states `pattern-editor` (Schedule tab → Edit hours / Request a change) and `time-field-open` (the editor with Monday's time picker open) on `/profile` (owner) and `team-member` (owner); `EMPTY_CTX` for the nested opener.
- `e2e/changelog/commit-captures.spec.ts`: a `profile-pattern-request` capture (practitioner proposing hours).
- Responsive gate finding fixed on the way: the pickers' popovers were 160–270 px wide on a 375 px phone (`dialog.narrow`); `time-field.tsx` and `date-field.tsx` now span `calc(100vw - 2rem)` under `sm`, the two time columns stretch and the calendar centres.

### r2-p7-03-unit-guards

- Unit tests this round: `field-parse` (7), `invoice-document` (4), `staff-schedule` pattern-summary block (+2), `staff-requests` (3). `npx vitest run`: **214 passed**, the same 11 pre-existing failures.
- Guards: `check:policy` ok — 184 handlers; `check:validators` only the two pre-existing `saveAppointment` problems; `check:tenancy` ok — 59 tables; `check:metrics` 16 / 17 (the pre-existing `insights-recalc.audit` mismatch).

### r2-p7-04-full-verify

| Check | Result | P0 baseline |
| ----- | ------ | ----------- |
| Unit | 214 passed, 11 failed (earnings 1, insights 4, period-picker 5, policy-scope 1) | 198 + the same 11 |
| Chromium e2e, full | **179 passed, 3 did not run, 7 failed** — exactly the recorded pre-existing set: `feedback-corrections:61`, `:209`, `:257`, `patients:246`, `reminders:10`, `team-chat-dock:100`, `treatment-workflow:60`. Every profile spec green (`profile-r2` 8/8, `profile-redesign`, `profile-governance`, `team`) | 171 + 9 (two of the nine were flakes that did not recur) |
| `test:metrics` (pinned clock) | 19 / 19 | 16 / 19 |
| Responsive gate, `RESPONSIVE_GATE=major`, 7 devices | **441 / 441** (`playwright.json`: expected 441, unexpected 0, flaky 0) | 441 / 441 |
| tsc | 109 errors, **0 new** against the 109 baseline (line-insensitive diff) | 109 |
| Lint | `new-by-line 0` on all 52 touched `.ts` / `.tsx` files (`/tmp/pf-newlint2.py`) | — |

### r2-p7-04b-stitching-qc-rerun

- `node launch-plan/gateway/test.mjs` → 12 / 12.
- `./launch-plan/qc/run.sh` at `83c9669` (Chromium desktop + WebKit iPhone 15, throwaway app 8094 + gateway 8097) → **40 / 40, 411 checks**; `launch-plan/qc/REPORT.md` regenerated and stamped `83c9669`.
- The Phase S click-through (`/tmp/r2-stitch.mjs`) through the live gateway on 8099: **32 / 32 flows** land where they did before, screenshots to `captures/after/stitching-*`; the block diff against the Phase S set is 0.0–0.3 % on every pair.
- One operational lesson recorded: `lsof -ti tcp:8090 | xargs kill` also kills the gateway (it holds client sockets to 8090). The gateway was restarted; both are up.

### r2-p7-05-after-captures

- Profile scenes retaken on a freshly started demo app (fixture state) with the P0 names into `captures/after/`; stitching flows as above. The README's Regression proof has a profile table (what changed per scene) and a stitching table (desktop · phone before / after, where each flow lands).

### r2-p7-06-docs-commit

- `docs/profile-redesign/r2/README.md`: commit per phase, all 49 to-dos `done` with their worklog anchors, the two side-by-side tables. This worklog. Committed; not pushed. The gateway on 8099 and the app on 8090 are left running.

## Round summary

Ten commits on top of `b2bf012` (`fc1f672` … `83c9669` + docs). The website ↔ demo stitching is committed and proven on Chromium and WebKit (nothing had regressed; the stack simply was not running). On the profile: themed time and date pickers; the four people tiles above the chart; a real working-pattern approval flow (propose → pending → approve / decline / withdraw, with the owner-only path for managers and a "Requests to approve" chip on the dashboard covering pattern and time-off requests); Create invoice available to the owner / Set-staff-commission holders on a colleague's page; and an invoice document that previews, prints alone as A4 named after its number, and travels as HTML in the email.

Follow-ups not in scope: the native time / date inputs outside the profile; a byte-level PDF file (jsPDF) instead of the browser's Save as PDF; the Team page's request inbox listing pattern requests; the diary reading patterns and time off.
