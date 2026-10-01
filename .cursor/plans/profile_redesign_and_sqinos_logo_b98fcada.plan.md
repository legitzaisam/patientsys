---
name: Profile redesign and Sqinos logo
overview: Rebuild the staff profile pages (/profile and /team/$id) to the Option 1 Classic mockup with real data for working pattern, time off, invoices and bookable treatments; owner and manager get the full layout (manager behind two owner-toggleable keys), every other staff role gets the Front desk layout; swap the brand mark and wordmark to Sqinos everywhere the shared BrandMark renders. Nothing else changes. Ten phases from least to most dependent, each with its own worklog and one entry per to-do.
todos:
  - id: p0-01-docs-index
    content: "P0: create docs/profile-redesign/README.md (phase table, to-do table with status column, worklog links) and worklog/00-baseline.md"
    status: completed
  - id: p0-02-baselines
    content: "P0: record tsc error count, eslint findings for files to be touched, unit/e2e counts into worklog/00; confirm guards green on the current tree"
    status: completed
  - id: p0-03-before-captures
    content: "P0: capture before-state of /profile, /team/<nadia> (owner, manager, practitioner, front desk), plus dashboard, diary, patients, record, retention, insights, performance, offers, team, settings, portal home to docs/profile-redesign/captures/before/"
    status: completed
  - id: p0-04-commit
    content: "P0: commit docs scaffold and before captures (exact paths only); worklog/00 entry"
    status: completed
  - id: p1-01-assets
    content: "P1: copy sqinos-mark.svg, sqinos-mark-inverse.svg, favicon.svg into public/ with the C2PA metadata block stripped; regenerate public/favicon.ico from favicon-64.png; worklog/01 entry"
    status: completed
  - id: p1-02-brandmark
    content: "P1: BrandMark renders the inline ring-and-drop SVG (gold = navy ring, on-gold = light ring) at the existing sizes, no chip background; worklog/01 entry"
    status: completed
  - id: p1-03-wordmark
    content: "P1: BrandLockup wordmark 'SQINOS' with wide tracking; light prop unchanged; worklog/01 entry"
    status: completed
  - id: p1-04-favicon-link
    content: "P1: __root.tsx adds the favicon.svg icon link before the .ico fallback; worklog/01 entry"
    status: completed
  - id: p1-05-verify-commit
    content: "P1: screenshots of clinic sidebar, patient portal sidebar, /auth, /portal, /, favicon; tsc + lint delta 0; commit; worklog/01 summary"
    status: completed
  - id: p2-01-pattern-helpers
    content: "P2: src/lib/staff-schedule.ts — WEEKDAYS, PatternRow type, patternSummary ('Mon, Wed 9–5:30 · Thu 12–8'), weeklyHours, isWorkingDay; worklog/02 entry"
    status: completed
  - id: p2-02-timeoff-helpers
    content: "P2: workingDaysBetween(range, pattern, startHalf, endHalf), overlapsRange, timeOffTotals(year) (taken / booked / pending); worklog/02 entry"
    status: completed
  - id: p2-03-calendar-helpers
    content: "P2: monthGrid(year, month) cells with weekday offsets, dayState (work/off/holiday/training/pending), nextWorkingDays(pattern, from, n) for 'Your week'; worklog/02 entry"
    status: completed
  - id: p2-04-bank-holidays
    content: "P2: UK_BANK_HOLIDAYS England and Wales 2026–2027 with substitute days; upcomingBankHolidays(today, 3); worklog/02 entry"
    status: completed
  - id: p2-05-invoice-helpers
    content: "P2: invoiceNumber(initials, month), invoicePeriod(month), nextInvoiceSendDate; earnings grouping helpers groupLinesByDay / byMonth / byTreatment for the earnings table; worklog/02 entry"
    status: completed
  - id: p2-06-unit-tests
    content: "P2: tests/unit/staff-schedule.test.ts covering every helper with the mockup fixtures (Nadia's pattern, Oct 2026, Nov 9–13 = 4 working days); run unit; commit; worklog/02 summary"
    status: completed
  - id: p3-01-keys
    content: "P3: permissions.ts — add team.manage_profiles ('Edit staff profiles') and team.commission ('Set staff commission') to PERMISSION_KEYS, META (managerOnly: true) and the Team group; worklog/03 entry"
    status: completed
  - id: p3-02-grid
    content: "P3: access-control-settings.tsx renders managerOnly keys with the Receptionist and Practitioner cells as a dash labelled 'Manager only'; worklog/03 entry"
    status: completed
  - id: p3-03-seed-migration
    content: "P3: migration 20261001000100_team_profile_keys.sql seeding both keys (manager true; practitioner and front_desk false); demo rolePermissions rows; worklog/03 entry"
    status: completed
  - id: p3-04-policy
    content: "P3: policy.ts — updateStaffMember → capability team.manage_profiles; setCommissionRate → team.commission; identity helper canManageProfiles / canSetCommission (owner or admin, or manager role holding the key) in src/lib/staff-access.ts used by server and UI; worklog/03 entry"
    status: completed
  - id: p3-05-existing-fns
    content: "P3: other-person paths in listMyDocuments, setMyAvatar(targetUserId) and getMyEarnings(userId) require canManageProfiles (earnings also canSetCommission); demo twins use the same helper; fix demo setCommissionRate (no authorization) and demo deleteMyDocument (no caller scope); worklog/03 entry"
    status: completed
  - id: p3-06-verify-commit
    content: "P3: unit tests for permissions/access-catalogue key lists updated; check:policy, check:validators; owner grid shows both keys; commit; worklog/03 summary"
    status: completed
  - id: p4-01-migration-tables
    content: "P4: migration 20261001000200_staff_schedule_invoices_bookable.sql — staff_working_patterns, staff_time_off, practitioner_treatments, practitioner_invoices with clinic_id, uniques, RLS is_staff + clinic_isolation, grants, comments; worklog/04 entry"
    status: completed
  - id: p4-02-types-scope
    content: "P4: types.ts Row/Insert/Update for the four tables; CLINIC_SCOPED_TABLES entries; check:tenancy green; worklog/04 entry"
    status: completed
  - id: p4-03-demo-fixtures
    content: "P4: demo/data.ts — patterns (Nadia Mon/Wed 09:00–17:30, Thu 12:00–20:00, Fri 09:00–15:00, Sat 09:00–17:00; Amara, Tom, Sofia Mon–Fri, Maya Mon–Fri), Nadia time off (14 Oct training + 19–23 Oct holiday approved, 30 Oct holiday pending, 14 days taken earlier in the year), bookable lists for the three practitioners, Nadia's August invoice sent 1 Sep paid 5 Sep; export via db; worklog/04 entry"
    status: completed
  - id: p4-04-verify-commit
    content: "P4: check:tenancy, tsc, unit; commit; worklog/04 summary"
    status: completed
  - id: p5-01-schedule-fns
    content: "P5: getStaffSchedule(userId?, year) → pattern, timeOff, totals, pendingCount (self, or canManageProfiles; others get pattern + approved dates only); setWorkingPattern(userId, rows) (manage); requestWorkingPatternChange(note) → staff notification to owner + managers holding the key, linking to /team/<me>?tab=schedule; prod + demo + schemas; worklog/05 entry"
    status: completed
  - id: p5-02-timeoff-fns
    content: "P5: requestTimeOff (self; computes working_days; notifies approvers), withdrawTimeOff (self, pending only), reviewTimeOff(id, approve, note) (manage; notifies requester), addTimeOff(userId, …) (manage, lands approved); prod + demo + schemas; worklog/05 entry"
    status: completed
  - id: p5-03-bookable-fns
    content: "P5: listBookableTreatments(userId) (staff), setBookableTreatments(userId, catalogueIds) (manage); prod + demo + schemas; worklog/05 entry"
    status: completed
  - id: p5-04-invoice-fns
    content: "P5: listPractitionerInvoices(userId?), createPractitionerInvoice({ month, recipient, note, mode }) computing amount and count with the getMyEarnings share maths; send = staff notification to the owner + transactional email via the comms outbox to the clinic email (payroll) or the owner's email; schedule = scheduled_for first of next month; markInvoicePaid(id) (canSetCommission); prod + demo + schemas; worklog/05 entry"
    status: completed
  - id: p5-05-invoice-drain
    content: "P5: scheduled invoices go out on the outbox drain (dispatch.server.ts runs deliverScheduledInvoices before offer automation; demo drainCommunications twin); unit test for the due filter; worklog/05 entry"
    status: completed
  - id: p5-06-staff-profile-fn
    content: "P5: getStaffProfile returns canManage, canCommission, bookable, pattern, upcomingUnavailable (approved dates only) and strips registration number/expiry, insurance and commission when the viewer cannot manage; getMyProfile returns bookable + pattern summary; worklog/05 entry"
    status: completed
  - id: p5-07-verify-commit
    content: "P5: check:policy, check:validators, check:tenancy, unit; demo smoke via server-function probe for each new function per persona (owner, manager key on/off, practitioner, front desk); commit; worklog/05 summary"
    status: completed
  - id: p6-01-page-shell
    content: "P6: src/components/profile/staff-profile-page.tsx with mode self | manage | frontdesk, data loading (profile, schedule, earnings month, documents, bookable, invoices), tab state in the URL (?tab=); profile.tsx renders it as self; team.$id.tsx picks manage or frontdesk from getStaffProfile and keeps Back to team, self redirect and the revoked/restore path; worklog/06 entry"
    status: completed
  - id: p6-02-hero
    content: "P6: profile-hero.tsx — StaffAvatar lg with camera badge, name, 'Job title · NMC 18C4471E · Self-employed', chips (renewal in N days → Overview, Insured to Mon YYYY, N documents to upload → Documents), actions (self: Create & send invoice, Request time off; manage: Add time off); worklog/06 entry"
    status: completed
  - id: p6-03-tabs
    content: "P6: profile-tabs.tsx — standard pill track, Overview / Performance & earnings / Schedule & time off / Documents (badge N/10) / Security (self only) / Access (manage only), data-qc profile-tab-<key>, scroll-x on phones; worklog/06 entry"
    status: completed
  - id: p6-04-personal-details
    content: "P6: personal-details-card.tsx — view tiles (Name, Job title with pending chip, Work email locked, Working arrangement locked); Edit mode (title select, full name, job title, locked fields with 'Locked · managed by your clinic owner', amber approval note, Cancel / Send for approval via submitProfileChange; owner self and manage save directly via saveMyProfile / updateStaffMember); manage adds Access level and, with canCommission, Commission rate; 'Request a change' link keeps the locked-fields dialog; worklog/06 entry"
    status: completed
  - id: p6-05-registration-insurance
    content: "P6: registration-insurance-card.tsx — ring with days to renewal, PIN, Renew by; 'I've renewed' → date → submitProfileChange (registrationExpiry) or direct save; 'Check <body> register ↗' per body; insurance tick card with 'Update policy' inline insurer + expiry via saveMyInstantProfile and 'N days left'; worklog/06 entry"
    status: completed
  - id: p6-06-qualifications
    content: "P6: qualifications-card.tsx — chips split from the qualifications text, add/remove writes back instantly via saveMyInstantProfile ('Saves instantly'); divider; 'Treatments front desk can book you for' chips ('Set by your manager'), multi-select editor in manage mode via setBookableTreatments; worklog/06 entry"
    status: completed
  - id: p6-07-right-column
    content: "P6: month-so-far-card.tsx (bg-foreground: month-to-date share, treatments, outstanding, See earnings, Create <Month> invoice), your-week-card.tsx (next four working days with booking counts from listAppointments, Day off rows, Request time off), documents-summary-card.tsx (N of 10 essential, missing names, Upload now); worklog/06 entry"
    status: completed
  - id: p6-08-verify-commit
    content: "P6: Overview renders for practitioner self, owner self, owner on Nadia, manager on Nadia; existing profile-governance flows still pass; responsive check phone/tablet/desktop; commit; worklog/06 summary"
    status: completed
  - id: p7-01-month-stepper
    content: "P7: earnings-tab.tsx — month stepper (prev/next, next disabled at current month), note '1–27 Sep · month in progress' or 'Invoice sent · paid 5 Sep' from listPractitionerInvoices, Export CSV (toCsv moved here) and Create & send invoice; worklog/07 entry"
    status: completed
  - id: p7-02-kpis-chart
    content: "P7: four KPI cards (Your earnings, Collected, Outstanding, Treatments with average) with metric:earnings.* hooks; Daily earnings bars from lines grouped by day (off days flat, future days dashed, selected day butter, detail well); worklog/07 entry"
    status: completed
  - id: p7-03-table-tiles
    content: "P7: Earnings table with By day / By month / By treatment pill (By month from one six-month getMyEarnings call plus invoice status), totals footer; bottom tiles Patients seen, New patients, Attendance, Retention; worklog/07 entry"
    status: completed
  - id: p7-04-invoice-dialog
    content: "P7: invoice-dialog.tsx — two panes; period buttons (current and previous month with state notes), Send to radio cards with the real addresses, note, 'Schedule to send on 1 <Mon>' / 'Send now' / 'Download PDF' (print of the preview pane), done states; useUnsavedChanges; worklog/07 entry"
    status: completed
  - id: p7-05-verify-commit
    content: "P7: earnings tab for practitioner self and owner/manager (canCommission) on Nadia; hidden for a manager without team.commission; CSV downloads; invoice schedule → Scheduled; commit; worklog/07 summary"
    status: completed
  - id: p8-01-working-pattern
    content: "P8: working-pattern-card.tsx — day rows with hour bars 07:00–21:00, times on the right, weekly hours; self: 'Request a change' → note dialog → 'Change requested ✓'; manage: inline start/end inputs + Save via setWorkingPattern; worklog/08 entry"
    status: completed
  - id: p8-02-calendar
    content: "P8: time-off-calendar.tsx — month stepper, legend Working / Holiday / Training / Pending, cells from monthGrid + dayState with the day's hours tag; worklog/08 entry"
    status: completed
  - id: p8-03-requests-column
    content: "P8: time-off-summary-card.tsx (taken / booked / pending, Request time off), time-off-requests-card.tsx (Pending + Withdraw, Approved / Declined; manage: Approve / Decline with note), bank-holidays-card.tsx (next three); worklog/08 entry"
    status: completed
  - id: p8-04-time-off-sheet
    content: "P8: time-off-sheet.tsx — right Sheet; type pills; month calendar first/last tap; start/end half-day selects; working-day count skipping days off; amber impact 'N patients are booked on these days' from listAppointments; note; Send request → requestTimeOff (manage: addTimeOff); done state; useUnsavedChanges; worklog/08 entry"
    status: completed
  - id: p8-05-verify-commit
    content: "P8: request → pending in calendar and list → withdraw; manager approves → Approved and calendar Holiday; pattern edit saves; commit; worklog/08 summary"
    status: completed
  - id: p9-01-documents-tab
    content: "P9: documents-tab.tsx — progress ring header, Needs uploading rows with Upload (existing storage + addMyDocument flow), On file rows (category, title, file · size · date, status chip Renew by / Valid to / Verified / Optional / Awaiting check, View, Replace), dashed 'Add other certificates'; read-only in manage mode; worklog/09 entry"
    status: completed
  - id: p9-02-security-access
    content: "P9: Security tab = SecuritySettings embedded (self only); Access tab = EffectivePermissions (manage only); worklog/09 entry"
    status: completed
  - id: p9-03-frontdesk-layout
    content: "P9: front-desk-view.tsx — hero with Prescriber chip (GMC/GDC, or NMC/GPhC with Prescriber/V300 in qualifications) and 'Cleared to practise' from complianceStatus, 'Book with <First name>' opening QuickAddAppointment with defaultPractitionerId, 'Can be booked for' (bookable chips + work email), 'Hours & unavailable' (patternSummary + approved dates as Unavailable); no registration numbers, insurance, earnings or documents; worklog/09 entry"
    status: completed
  - id: p9-04-retire
    content: "P9: remove profile-account-tabs.tsx, staff-record-tabs.tsx, earnings/practitioner-earnings.tsx, earnings/earnings-lines-table.tsx, performance/my-performance-kpis.tsx after the last import goes; /earnings keeps redirecting; worklog/09 entry"
    status: completed
  - id: p9-05-verify-commit
    content: "P9: practitioner and front desk on Nadia see the Front desk layout; manager with team.manage_profiles off sees it too; documents upload/replace round-trip in demo; commit; worklog/09 summary"
    status: completed
  - id: p10-01-e2e-new
    content: "P10: e2e/profile-redesign.spec.ts — practitioner self (hero chips, tabs, chip add/remove, I've renewed, stepper + groupings, time off request/withdraw, invoice schedule, documents count); owner on Nadia (commission, pattern, bookable, approve); manager key on / off (Me → Front desk); front desk on Nadia; worklog/10 entry"
    status: completed
  - id: p10-02-e2e-updates
    content: "P10: update feedback-corrections profile test, profile-governance, team.spec, metrics/rendered.spec.ts, responsive/pages.ts (profileTab keys, team-member manage/frontdesk states), changelog and review capture specs; worklog/10 entry"
    status: completed
  - id: p10-03-full-verify
    content: "P10: check:policy/validators/tenancy/metrics, unit, full Chromium e2e (only the pre-existing failures), test:metrics, responsive gate at major (full), tsc delta ≤ 0, lint delta 0 on touched files; worklog/10 entry"
    status: completed
  - id: p10-04-after-captures
    content: "P10: after-state captures of every page listed in P0 into captures/after/ and a side-by-side table in the README proving only /profile, /team/<id> and the logo changed; worklog/10 entry"
    status: completed
  - id: p10-05-docs-commit
    content: "P10: finish docs/profile-redesign/README.md (every to-do done with its worklog link), root README note on the two keys; commit (no push unless asked); worklog/10 summary"
    status: completed
isProject: false
---

# Profile redesign and Sqinos logo

Decisions confirmed: role-routed views (no View-as toggle); the missing features are built for real (schema, server functions, demo fixtures); new mark **and** wordmark `SQINOS` everywhere `BrandMark` renders; **two** new owner-toggleable keys for the manager.

**Who gets which layout.** Owner (and software admin) always see the full "Me" layout of any colleague. A manager sees it only while the owner has granted `team.manage_profiles`, and sees commission and earnings inside it only with `team.commission`. Every other staff role — practitioners, receptionists, anyone else — always sees the Front desk layout of a colleague, regardless of grants. On your own `/profile` everyone sees the Me layout of themselves.

Branch `e2e_live`; commits carry the existing author identity; `.cursor/`, `Claude outputs/`, `.tmp-*` and the other agent's uncommitted files (`launch-plan/`, `src/components/app-shell.tsx`, `src/routes/auth.tsx`, `index.tsx`, `portal.tsx`, `vite.config.ts`, `src/lib/demo/enabled.ts`) are never staged — every `git add` lists exact paths. No push unless asked.

```mermaid
flowchart LR
  self["/profile (own page)"] --> me["Me layout: hero, Overview, Performance and earnings, Schedule and time off, Documents, Security"]
  team["/team/$id (colleague)"] --> who{viewer}
  who -->|owner or admin| manage["Me layout for a colleague incl. commission and earnings; Access tab kept"]
  who -->|manager with team.manage_profiles| mgr{team.commission?}
  mgr -->|yes| manage
  mgr -->|no| manageNoMoney["Me layout without Commission field and without Performance and earnings"]
  who -->|manager without the key, practitioner, receptionist, other| fd["Front desk layout: Prescriber / Cleared to practise chips, Book with X, Can be booked for, Hours and unavailable"]
```

## Documentation contract (every phase, every to-do)

- `docs/profile-redesign/README.md`: phase table (worklog link, scope, commit) and a to-do table (`id | phase | what | status | worklog anchor`). Updated at the end of every phase.
- `docs/profile-redesign/worklog/NN-<phase>.md`: one `### <todo-id>` section per to-do written as that to-do finishes — files changed, what changed and why, how it was checked (command or screenshot path), anything left for a later to-do — plus a phase summary (verification table, commit hash, lint and tsc deltas).
- Captures under `docs/profile-redesign/captures/before/` (P0) and `captures/after/` (P10), same file names, so the regression proof is a side-by-side.

## Theme mapping (applies to all UI phases)

Cards → `Card`; soft wells `#FAF7F1` → `bg-glass-2 shadow-inset-hi`; butter CTAs → default `Button`; dark month card `#2A3152` → `bg-foreground text-background`; amber / green / pink chips → `warning` / `success` / `destructive` bg and ink tokens; lilac → the existing lilac tone; tab bar → the standard pill track (full-width content tabs, exempt from the right-of-title rule), `data-qc="profile-tab-<key>"`; every rendered number keeps or gains `data-qc="metric:…"` (`metric:earnings.share|collected|treatments` preserved); no left accent rails.

## Phase 0 — Baseline and scaffolding (depends on nothing)

Docs index and worklog scaffold; tsc / lint / test baselines recorded; before-captures of `/profile` and `/team/<nadia>` for owner, manager, practitioner and front desk, and of every page that must not change (dashboard, diary, patients, record, retention, insights, performance, offers, team, settings, patient portal home). One commit.

## Phase 1 — Logo (depends on nothing)

- `public/`: `sqinos-mark.svg`, `sqinos-mark-inverse.svg`, `favicon.svg` copied with the C2PA `<metadata>` block stripped; `favicon.ico` regenerated from `favicon-64.png` (Pillow or sharp, whichever is installed).
- [src/components/brand-mark.tsx](src/components/brand-mark.tsx): `BrandMark` renders the inline ring-and-drop SVG (ring `var(--foreground)`, drop gradient `#fffaf0 → #eed488 → #c9a64a`) at the existing 28 / 30 px sizes with no chip background; `variant="on-gold"` uses the light ring. `BrandLockup` wordmark `SQINOS` (`tracking-[0.06em]`); `light` prop unchanged.
- [src/routes/__root.tsx](src/routes/__root.tsx) line 111: `{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }` before the `.ico` link.
- Visible in the patient portal only as the sidebar and login logo, by your choice. Route `<title>` strings still read "— Aetheria" (follow-up, see the end).

## Phase 2 — Pure helpers (depends on nothing)

`src/lib/staff-schedule.ts`, no I/O: pattern (`patternSummary`, `weeklyHours`, `isWorkingDay`), time off (`workingDaysBetween` with half days, `overlapsRange`, `timeOffTotals`), calendar (`monthGrid`, `dayState`, `nextWorkingDays`), `UK_BANK_HOLIDAYS` (England and Wales 2026–2027, `upcomingBankHolidays`), invoices (`invoiceNumber` `INV-<initials>-YYYY-MM`, `invoicePeriod`, `nextInvoiceSendDate`), earnings grouping (`groupLinesByDay` / `byMonth` / `byTreatment`). `tests/unit/staff-schedule.test.ts` uses the mockup's fixtures (Nadia's pattern; Nov 9–13 2026 = 4 working days when Tue is off).

## Phase 3 — Capability keys and policy (depends on nothing; needed by P5)

- [src/lib/permissions.ts](src/lib/permissions.ts): `team.manage_profiles` — "Edit staff profiles": edit a colleague's details, working pattern, bookable treatments; approve their time off. `team.commission` — "Set staff commission": see and set a colleague's commission rate and open their Performance & earnings. Both `managerOnly: true`; Team group.
- `access-control-settings.tsx` (Team → Staff access, the page you named for the toggle): `managerOnly` keys show a dash for Receptionist and Practitioner ("Manager only"); the Manager switch works as today with the changed-by note.
- Migration `20261001000100_team_profile_keys.sql` seeds both keys (manager true; practitioner and front_desk false); demo `rolePermissions` rows.
- `src/lib/staff-access.ts`: `canManageProfiles(identity)` = owner or admin, or manager role holding `team.manage_profiles`; `canSetCommission(identity)` likewise with `team.commission`. Used by [src/lib/auth/policy.ts](src/lib/auth/policy.ts) moves (`updateStaffMember` → `team.manage_profiles`, `setCommissionRate` → `team.commission`), by the other-person branches of `listMyDocuments`, `setMyAvatar`, `getMyEarnings`, and by the UI. Demo twins share the helper. Two demo-only gaps closed on the way: `setCommissionRate` (no authorization) and `deleteMyDocument` (no caller scope).

## Phase 4 — Schema and fixtures (depends on nothing; needed by P5)

Migration `20261001000200_staff_schedule_invoices_bookable.sql`, each table with `clinic_id`, RLS `is_staff` + `clinic_isolation`, grants and comments as in `20260930000300_clinic_setup_roles.sql`:

- `staff_working_patterns` (user_id, weekday 0–6, start_time, end_time; null times = off) unique (user_id, weekday).
- `staff_time_off` (user_id, type holiday|training|sickness|other, starts_on, ends_on, start_half full|afternoon, end_half full|morning, working_days, note, status pending|approved|declined|withdrawn, requested_at, reviewed_by, reviewed_at, reviewer_note).
- `practitioner_treatments` (user_id, catalogue_id) unique.
- `practitioner_invoices` (user_id, number, period_start, period_end, recipient payroll|owner, note, status scheduled|sent|paid, scheduled_for, sent_at, paid_at, amount, treatments) unique (user_id, period_start).

`types.ts` rows, `CLINIC_SCOPED_TABLES`, and demo fixtures mirroring the mockup for Dr Nadia Rahman (pattern, October time off, August invoice paid 5 Sep, five bookable treatments), plain Mon–Fri patterns for the others, bookable lists for Amara and Tom.

## Phase 5 — Server functions (depends on P2, P3, P4)

Production in `clinic.functions.ts`, demo twins, zod schemas in `schemas.ts` (validator shape = schema fields for `check:validators`), POLICY rows:

- Schedule: `getStaffSchedule(userId?, year)`, `setWorkingPattern` (manage), `requestWorkingPatternChange(note)` → staff notification to the owner and managers holding the key, linking to `/team/<me>?tab=schedule`.
- Time off: `requestTimeOff` (self; `working_days` from the helper; notifies approvers), `withdrawTimeOff`, `reviewTimeOff` (manage; notifies the requester), `addTimeOff` (manage; lands approved).
- Bookable: `listBookableTreatments`, `setBookableTreatments` (manage).
- Invoices: `listPractitionerInvoices(userId?)`, `createPractitionerInvoice({ month, recipient, note, mode: send|schedule })` — amount and count from the same share maths as `getMyEarnings`; `send` = staff notification to the owner plus a transactional email through the comms outbox to the clinic email (payroll) or the owner's email; `schedule` = `scheduled_for` first of next month, delivered by `deliverScheduledInvoices` at the start of the outbox drain (`dispatch.server.ts`; demo `drainCommunications`); `markInvoicePaid` (canSetCommission).
- `getStaffProfile` adds `canManage`, `canCommission`, `bookable`, `pattern`, `upcomingUnavailable` (approved dates only) and strips registration number/expiry, insurance and commission when the viewer cannot manage; `getMyProfile` adds `bookable` and the pattern summary.

## Phase 6 — Page shell, hero, tabs, Overview (depends on P5)

`src/components/profile/staff-profile-page.tsx` with `mode: "self" | "manage" | "frontdesk"` drives [src/routes/_authenticated/profile.tsx](src/routes/_authenticated/profile.tsx) (self) and [src/routes/_authenticated/team.$id.tsx](src/routes/_authenticated/team.$id.tsx) (manage when `canManage`, else frontdesk; Back to team, self → `/profile` redirect and revoked/restore path kept). Hero, tab pill, and the Overview grid (`minmax(0,1fr) 360px`, single column under `lg`): Personal details (view tiles / Edit mode; manage adds Access level and, with `canCommission`, Commission rate), Registration & insurance rings, Qualifications chips + bookable treatments, right column month-so-far dark card, Your week, Documents progress. Field save paths are the existing ones: `submitProfileChange` for gated fields on a non-owner self page, `saveMyProfile` for the owner's own page, `updateStaffMember` in manage mode, `saveMyInstantProfile` for qualifications and insurance.

## Phase 7 — Performance & earnings (depends on P6)

Month stepper, KPI cards, daily bars, table with By day / By month / By treatment, bottom tiles, Export CSV, and `invoice-dialog.tsx`. Shown on the self page to practitioners and owners who treat, and in manage mode only with `canCommission`.

## Phase 8 — Schedule & time off (depends on P6)

Working pattern card (request a change / manage edit), month calendar with legend, time off summary, requests (Withdraw; Approve / Decline in manage mode), bank holidays, and `time-off-sheet.tsx` (self: `requestTimeOff`; manage: `addTimeOff`).

## Phase 9 — Documents, Security, Access, Front desk layout, retirement (depends on P6)

Documents tab on the existing upload flow; Security = `SecuritySettings embedded` (self only); Access = `EffectivePermissions` (manage only, kept so nothing an owner uses today disappears); `front-desk-view.tsx` for every non-owner, non-manager viewer and for managers without `team.manage_profiles`; retire `profile-account-tabs.tsx`, `staff-record-tabs.tsx`, `earnings/practitioner-earnings.tsx`, `earnings/earnings-lines-table.tsx`, `performance/my-performance-kpis.tsx`. `/earnings` keeps redirecting to `/profile`.

## Phase 10 — Tests, full verification, after-captures, docs (depends on everything)

New `e2e/profile-redesign.spec.ts` (practitioner self, owner on Nadia, manager Maya with keys on then off, front desk on Nadia); updates to the touched specs and the responsive matrix; guards, unit, full Chromium e2e (only the known pre-existing failures), `test:metrics`, full responsive gate at major, tsc delta ≤ 0, lint delta 0 on touched files; after-captures side by side with P0's; README and worklog finished; final commit, no push unless asked.

## Explicit non-goals (so other pages stay untouched)

- The diary does not yet read working patterns or time off, booking forms do not yet filter by bookable treatments, and the dashboard's Attention list does not list time-off or pattern requests — approvers are reached through the existing staff notification bell (the notification links to the colleague's Schedule tab). All three are the natural follow-on once this lands.
- The Staff access grid change is limited to rendering the two manager-only keys; no other row or behaviour moves.
- Route `<title>` strings still read "— Aetheria"; say if the wordmark change should reach them and the sign-in email copy.
