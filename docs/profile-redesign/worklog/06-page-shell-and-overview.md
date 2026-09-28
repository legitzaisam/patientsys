# Phase 6: page shell, hero, tabs, Overview

Branch `e2e_live`, on top of `b874d4f`. 28 Sep 2026. The staff profile now has one component tree under `src/components/profile/` rendered in three modes — `self` (`/profile`), `manage` and `frontdesk` (`/team/<id>`, chosen from `getStaffProfile.canManage`). This phase delivers the shell, the hero, the tab pill and the Overview tab; the other tabs render the existing components until Phases 7–9 replace them, so nothing an owner uses today disappears.

Captures for this phase: [`captures/p6-overview/`](../captures/p6-overview/) — `p6-profile-practitioner.jpg`, `p6-profile-owner.jpg`, `p6-profile-frontdesk.jpg`, `p6-team-nadia-owner.jpg`, `p6-team-nadia-manager.jpg`, `p6-team-nadia-frontdesk.jpg`, plus `p6-phone-*` (390 px) and `p6-tablet-*` (820 px).

### p6-01-page-shell

- `src/components/profile/profile-types.ts` (new): `ProfileMode`, `ProfileTabKey`, `ProfileSubject` (everything a card needs about the person: identity fields, registration, insurance, qualifications, pattern, bookable, upcoming unavailability, change requests, documents, present categories, capabilities, revoked state) and `ProfileViewer` (who is looking: roles, owner/admin/manager, `canSelfApply`, `requiresOwner`, `canCommission`, `treats`).
- `src/components/profile/profile-helpers.ts` (new): the non-component helpers so every `.tsx` in the folder exports components only (`react-refresh/only-export-components` clean): `asProfileTab` (narrows `?tab=`), `daysUntil`, `monthYear`, `heroChips`, `monthRangeOf`, `splitQualifications`, `joinQualifications`, `invalidateProfileQueries` (`my-profile`, `staff-profile/<id>`, `me`, `team`), `useStaffSchedule` (query `["staff-schedule", "self" | userId]`).
- `src/components/profile/staff-profile-page.tsx` (new): composes hero → tab pill → the active tab. Tabs are built per mode: Performance & earnings only when the subject treats and (self, or `viewer.canCommission`); Security only on `self`; Access only in `manage` when capabilities came back. An unknown or hidden tab key falls back to Overview. Overview grid is `lg:grid-cols-[minmax(0,1fr)_360px]`, single column under `lg`. Interim tabs: earnings → existing `PractitionerEarnings` with the page-level `PeriodPicker`; schedule → one-line pattern summary + totals (P8); documents → `StaffDocuments` (read-only for others, `["staff-documents", id]` key); security → `SecuritySettings embedded`; access → `EffectivePermissions`. The hero's invoice and time-off actions open their tabs until P7/P8 hand them the dialog and the sheet. Root `data-qc="profile-page-<mode>"`.
- `src/routes/_authenticated/profile.tsx` (rewritten): `validateSearch` keeps `?tab=`; loads `getMyProfile` + `listMyDocuments`, builds the subject/viewer and renders the page as `self`. `treats` = practitioner role, or the owner when `identity.treatsPatients`. Head meta unchanged.
- `src/routes/_authenticated/team.$id.tsx` (rewritten): `validateSearch` for `?tab=`; keeps Back to team (`team.view`), the self → `/profile` redirect, and the revoked card with the owner's Restore access (`restoreExTeamMember`, same invalidations). Mode is `manage` when `getStaffProfile.canManage`, else `frontdesk`; subtitle reads per mode. The old 350-line react-hook-form editor is gone (its lint baseline of 355 findings with it).
- Checked: tsc 109 errors (baseline 116; the two old route files carried seven), no new errors; `/tmp/pf-newlint2.py` delta 0 on every file in the folder and both routes; six-persona render probe (below) with no console or page errors.

### p6-02-hero

- `src/components/profile/profile-hero.tsx` (new): `Card` with `StaffAvatar variant="badge"` (104 px, camera button on the corner, hidden in `frontdesk` and on revoked profiles), the name (`data-qc="profile-name"`), the meta line "Aesthetic Practitioner · NMC 18C4471E · Self-employed" (registration only when the body is known and the viewer may see the number), and the chips from `heroChips`: `<Body> renewal in N days` (≤ 90 days, warning) / `registration lapsed` / `registered`; `Insurance renews in N days` (≤ 60) / `lapsed` / `Insured to Apr 2027`; `N documents to upload` (destructive → Documents tab). Chips are buttons that jump to their tab (`data-qc="profile-chip-<id>"`). Actions: self — `Create & send invoice` (only when the person treats) and `Request time off`; manage — `Add time off`; frontdesk — none.
- `src/components/staff-files.tsx`: `StaffAvatar` gained `variant?: "stack" | "badge"`; the existing stack layout is untouched. The badge wrapper is `w-fit self-start` so the camera stays on the avatar when the hero stacks on phones (first phone capture had it drifting right).
- Checked: probe output — practitioner chips `["NMC renewal in 46 days","Insured to Apr 2027","7 documents to upload"]`, owner `["GMC registered","Insured to Feb 2027","5 documents to upload"]`, front desk on Nadia `["7 documents to upload"]` (registration and insurance withheld by `getStaffProfile`).

### p6-03-tabs

- `src/components/profile/profile-tabs.tsx` (new): the standard pill track (`h-[34px] rounded-full border-edge bg-glass-2 p-0.5 shadow-inset-hi`, segments `h-7 rounded-full px-3.5 text-xs`, active `bg-accent-soft font-semibold shadow-[inset_0_0_0_1px_var(--edge)]`), inside `scroll-x-plain` so it scrolls sideways on phones. Optional badge per tab (Documents shows `3/10` in destructive ink while essentials are missing). `data-qc="profile-tabs"`, `data-qc="profile-tab-<key>"`, `aria-pressed` on the active segment. Full-width content tab bar, so exempt from the right-of-title rule.
- Checked: probe tab lists — practitioner self `overview, earnings, schedule, documents, security`; owner self the same; owner/manager on Nadia `overview, earnings, schedule, documents, access`; front desk on Nadia `overview, schedule, documents`; front desk self `overview, schedule, documents, security`. Phone capture shows the track scrolling with the page width intact (`scrollWidth` 390 = viewport).

### p6-04-personal-details

- `src/components/profile/personal-details-card.tsx` (new): view tiles in `bg-glass-2 shadow-inset-hi` wells — Name, Job title (with the pending chip `“Lead injector” awaiting approval` / `awaiting the clinic owner` from the open change request), Work email and Working arrangement (lock icon when the viewer cannot change them directly); manage adds Access level and, with `canCommission`, Commission rate (`tile-*` hooks). `Edit` swaps in the form: title select + Full name, Job title, Work email, Working arrangement, and in manage mode Access level (`owner` only for owners, `manager` only when the clinic has a separate manager) and Commission rate. Locked fields show "Locked · managed by your clinic owner"; non-owner self shows the amber approval note and the reviewer note; footer is `Request a change to email or arrangement` (the locked-fields dialog, `profile-request-locked`) + Cancel + `Send for approval` (`profile-request-approval`) or `Save changes` (`personal-details-save`). Save paths: manage → `updateStaffMember`; owner self → `saveMyProfile`; other self → `submitProfileChange`. A status line (`personal-details-status`) confirms "Saved." or "Sent to your manager / the clinic owner — you’ll be notified when it’s approved."
- `SELECT_CLASS` and `Tile` are exported for the other cards.
- Checked: `e2e/profile-governance.spec.ts` "owner can save identity fields; staff request approval" rewritten for the new layout (click `personal-details-edit` first, assert the status line and the pending chip) — passes; the practitioner → manager → owner inbox chain is unchanged.

### p6-05-registration-insurance

- `src/components/profile/registration-insurance-card.tsx` (new): two wells. Registration: `DaysRing` (SVG arc, days to expiry, tone warning ≤ 90 / destructive when lapsed / success otherwise), "<Body> registration", PIN, "Renew by <date>"; `I've renewed` (`registration-renewed`) opens a date input → `registration-renew-save` → owner self or manage saves directly (`saveMyProfile` / `updateStaffMember`), other self sends `submitProfileChange` with the new expiry and shows `registration-renew-sent`; `Check <body> register ↗` per body (NMC, GMC, GDC, GPhC, HCPC, JCCP). Insurance: `CheckRing`, insurer, "Certificate on file", "Valid until <date>", `Update policy` (`insurance-update`) → inline insurer + expiry → `insurance-save` via `saveMyInstantProfile` (self) or `updateStaffMember` (manage), and "N days left". Header note: "Owner reminded 60 days before expiry". Hidden entirely when the subject has neither a body nor an insurer (front desk staff), and when the viewer cannot see the numbers.
- Checked: renders 46 / 201 days for Nadia (owner, manager, self); absent on the front-desk view of Nadia and on Sofia's own page.

### p6-06-qualifications

- `src/components/profile/qualifications-card.tsx` (new): qualifications split on commas / newlines into chips with × (`qualification-chip`), an add input + button (`qualification-input`, `qualification-add`); every add/remove writes the joined text back at once — `saveMyInstantProfile` (self) or `updateStaffMember` (manage) — and the header note flips "Saves instantly" → "Saving…" → "Saved" (`qualifications-saved`). Divider, then "Treatments front desk can book you for" (`bookable-chip`; "Set by your manager" on self); manage mode has `Edit` (`bookable-edit`) → `Checkbox` list from `getCatalogue` → `Save` (`bookable-save` → `setBookableTreatments`, invalidates `staff-profile/<id>` and `bookable/<id>`).
- Checked: `e2e/profile-governance.spec.ts` "qualifications save without a request" rewritten to add a chip and see it after reload — passes; probe shows 3 qualification chips and 5 bookable chips for Nadia, 7 bookable for Amara, none for Sofia.

### p6-07-right-column

- `src/components/profile/overview-side-cards.tsx` (new):
  - `MonthSoFarCard` — `bg-foreground text-background`, "<Month> so far", month-to-date share (`metric:earnings.month.share`), "N treatments · £X outstanding" (`metric:earnings.month.treatments`), `See earnings` → earnings tab, `Create <Month> invoice` (`month-invoice`; self only). Reads `getMyEarnings` for the current calendar month (`monthRangeOf`), `userId` in manage mode. Shown only when the earnings tab is.
  - `YourWeekCard` — "Your week" / "Their week", the next four working days from the pattern (`nextDays`) with booking counts from `listAppointments` filtered by `practitioner_id`, "Day off" rows for pattern gaps, approved time off as `week-time-off`; `Schedule` link and `Request time off` / `Add time off` button.
  - `DocumentsSummaryCard` — "N of 10" (`metric:documents.onFile`), progress bar, the first two missing names + "and N more", `Upload now` (self with gaps) or `Open documents` (`documents-open`).
- Checked: probe metrics — Nadia `£13,812.75 / 133 treatments / 3 of 10`, Amara `£6,218.00 / 62 treatments / 5 of 10`, four `week-day` rows for every viewer; the manager on Nadia sees the month card (`team.commission` on) and the front desk does not.

### p6-08-verify-commit

| Check | Result |
| ----- | ------ |
| Render probe (demo, 1440 px) | practitioner self, owner self, front desk self, owner / manager / front desk on Nadia — all render `profile-page-<mode>`, no console errors, hooks as listed above |
| `e2e/profile-governance.spec.ts` | 3 passed (both field-rule tests updated to the tile + Edit layout, flows unchanged) |
| `e2e/team.spec.ts`, `e2e/feedback-corrections.spec.ts` | `team.spec:12` (expects the old "Performance" h2 on the staff page), `feedback-corrections:236` (old profile tabs) and `:276` (earnings on the profile landing) now fail because the layout moved — they are on the P10 update list (`p10-02-e2e-updates`) since P7 rewrites the earnings tab they assert on. `team.spec:26` "Last active 2 days ago" vs "yesterday" is a wall-clock day-boundary flake in the unchanged team list; `:61`, `:209`, `:261` are the known pre-existing failures |
| Responsive | phone 390 / tablet 820 / desktop 1440 for `/profile` (practitioner) and `/team/<nadia>` (owner): document `scrollWidth` = viewport at all three; the only elements past the right edge are inside the tab track's own horizontal scroller |
| Guards | `check:policy` ok (182), `check:tenancy` ok (58) |
| Unit | 198 passed, the 11 pre-existing failures unchanged |
| tsc | 109 (baseline 116; −7 from the retired route code, 0 new) |
| Lint | delta 0 on all new files and both routes (`staff-files.tsx` 25 = 25) |

Files: `src/components/profile/{profile-types.ts, profile-helpers.ts, staff-profile-page.tsx, profile-hero.tsx, profile-tabs.tsx, personal-details-card.tsx, registration-insurance-card.tsx, qualifications-card.tsx, overview-side-cards.tsx}` (new), `src/routes/_authenticated/profile.tsx`, `src/routes/_authenticated/team.$id.tsx`, `src/components/staff-files.tsx`, `e2e/profile-governance.spec.ts`, captures under `docs/profile-redesign/captures/p6-overview/`.

Left for later phases: earnings tab (P7), schedule tab and the time-off sheet (P8), documents tab polish, Security/Access placement, the dedicated front-desk layout and retiring `profile-account-tabs.tsx` / `staff-record-tabs.tsx` (P9), spec updates (P10).

> Revised in P10: the Documents summary count is now `data-qc="documents-count"` (a file count, not a metrics-snapshot figure); the Month-so-far range comes from `monthWindowIso` (clinic-time month bounds) so it equals the metrics snapshot's `period=month` window.
