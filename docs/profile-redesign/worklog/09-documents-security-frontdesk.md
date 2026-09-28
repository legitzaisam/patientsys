# Phase 9: Documents, Security, Access, Front desk layout, retirement

Branch `e2e_live`, on top of `0d9f69a`. 28 Sep 2026. The last two tabs, the dedicated layout for everyone outside the management tier, and the removal of the components the new page replaced.

Captures: [`captures/p9-documents-frontdesk/`](../captures/p9-documents-frontdesk/) — `p9-documents-practitioner.jpg`, `p9-security-practitioner.jpg`, `p9-access-owner-on-nadia.jpg`, `p9-frontdesk-nadia.jpg` (front desk viewing Nadia), `p9-frontdesk-book.jpg` (Book with Nadia open), `p9-frontdesk-manager-key-off.jpg` (manager with Edit staff profiles off).

### p9-01-documents-tab

- `src/lib/staff-file-storage.ts` (new): the storage helpers that were private to `staff-files.tsx` — `STAFF_FILE_CATEGORIES`, `staffFileCategoryLabel`, `safeFileName`, `formatFileSize`, `openStaffFile` (signed URL; demo blob), and a new `uploadStaffFile(userId, file)` (10 MB check, bucket path, demo object URL). `staff-files.tsx` now imports them (its `CATEGORIES` export is preserved as an alias); its lint findings fell 25 → 12 with the moved lines.
- `src/components/profile/documents-tab.tsx` (new): `DocumentsTab({ mode, subject, todayKey })`, reading `listMyDocuments` (own, or `targetUserId` in manage mode). Header card with the progress ring (`done/10`) and the headline "7 required documents to upload" / "All required documents are on file" (`metric:documents.headline`). "Needs uploading" (`documents-missing`): one destructive-tinted row per missing essential (`document-missing`, `data-category`) with its reason and, on the self page, `Upload` (`document-upload`) → hidden file input → `uploadStaffFile` → `addMyDocument` with the category preset. "On file" (`documents-on-file`): newest first (`document-row`), category label, title, "file · size · date", a status chip (`document-status`): Statutory registration → "Renew by 13 Nov" (≤ 90 days) or "Valid to Nov 2026"; Indemnity insurance → "Renew by …" (≤ 60 days) or "Valid to Apr 2027"; non-essential categories → "Optional"; uploaded today → "Awaiting check"; otherwise "On file". `View` (`document-view`, `openStaffFile`) and, self only, `Replace` (`document-replace`: uploads the new file under the same category and title, then removes the old row). The dashed "Add other certificates" well (`documents-add-other`) takes a name (`documents-other-title`), a category (`documents-other-category`, default CPD / training) and `Choose files` (`documents-choose-files`). Manage mode is read-only: no Upload, Replace or add well.
- Invalidates the document list, `my-profile`, `staff-profile/<id>` and `team`, so the hero chip, the tab badge and the Overview card follow.
- Checked: probe — before 7 missing, 5 on file (`training: Optional`, `indemnity_insurance: Valid to Apr 2027`, `statutory_registration: Renew by 13 Nov`, `dbs: On file`, `qualification: Optional`); Upload on Right to work → "6 required documents to upload", new row "Awaiting check"; Replace keeps the row count; Add other → 7 rows; hero chip "6 documents to upload", tab badge "4/10"; the owner on Nadia sees 7 rows with View only.

### p9-02-security-access

- Security (self only): `SecuritySettings embedded` inside a `Card` (`profile-security-tab`) — email codes, password, sessions, as before. Access (manage only, when capabilities came back): `EffectivePermissions` for the person (`What Dr Nadia Rahman can do · 39 of 60 capabilities`). Both were wired in P6; this phase confirmed them once the other tabs stopped rendering the interim components and captured them.
- Checked: practitioner `/profile?tab=security` shows "Email codes ON · Asked at each sign-in and sent to nadia.rahman@aetheria.clinic · Password …"; owner `/team/<nadia>?tab=access` shows the capability grid with the two new Team rows ("Edit staff profiles", "Set staff commission") as dashes for a practitioner.

### p9-03-frontdesk-layout

- `getStaffProfile` (production and demo) now returns `compliance: { tone, label }` from `complianceStatus` computed on the server with the unstripped expiries, so a viewer who cannot see registration or insurance dates still gets the one line the Team list already shows them. `ProfileSubject.compliance` added; both routes map it.
- `src/components/profile/front-desk-view.tsx` (new): `FrontDeskView({ subject, treats })`, rendered by `StaffProfilePage` whenever `mode === "frontdesk"` instead of the hero and tabs (`profile-page-frontdesk`). Hero card: avatar (read-only), name, job title, `Prescriber` chip (`frontdesk-prescriber`, from `isPrescriber` in `profile-helpers.ts`: GMC / GDC, or NMC / GPhC with "prescriber" or "V300" in the qualifications), the compliance chip (`frontdesk-compliance`, `data-tone`: "Cleared to practise" in green when compliant, otherwise the label in butter or pink), and `Book with Nadia` (`frontdesk-book`) — `QuickAddAppointment` with `defaultPractitionerId`, patients / practitioners / catalogue loaded with the shared query keys; hidden for people who do not treat and for revoked profiles. Two cards: "Can be booked for" (`frontdesk-bookable`: `bookable-chip`s and "Work email: …") and "Hours & unavailable" (`frontdesk-hours`: `patternSummary` and each approved upcoming range as "Wed 14 Oct · Unavailable", `frontdesk-unavailable`). No registration numbers, insurance, earnings or documents anywhere on the page.
- Checked: probe — front desk on Nadia: `Prescriber`, "Registration expires in 46 days" (warn, the same line as the Team list), Book with Nadia opens the quick-add card with Nadia preselected, five bookable chips, the pattern line, two unavailable ranges, zero tabs, and no private strings (`NMC 18C4471E`, `Cosmetic Insure`, `Commission`, `£`) in the page text; Tom's page for a practitioner viewer: `Prescriber`, "Insurance expires in 29 days", six bookable, "Mon 16 – Fri 20 Nov Unavailable"; manager with `team.manage_profiles` turned off by the owner → the same front-desk layout; turned back on → `profile-page-manage`.

### p9-04-retire

- Removed `src/components/profile-account-tabs.tsx`, `src/components/staff-record-tabs.tsx`, `src/components/earnings/practitioner-earnings.tsx`, `src/components/earnings/earnings-lines-table.tsx`, `src/components/performance/my-performance-kpis.tsx` — nothing imported them once P6–P8 landed (checked with ripgrep across `src`, `e2e`, `tests`). `src/components/earnings/` is gone; `performance-table.tsx` and `staff-performance-kpis.tsx` stay. `/earnings` still redirects to `/profile`.
- The interim `StaffDocuments` embed and the `Card` import left `staff-profile-page.tsx` with the documents tab.

### p9-05-verify-commit

| Check | Result |
| ----- | ------ |
| Front-desk layout | practitioner on a colleague, front desk on Nadia, manager with the key off — all `profile-page-frontdesk`; manager with the key on — `profile-page-manage` |
| Documents round-trip (demo) | upload a missing essential, replace a file, add another certificate; owner read-only |
| `check:policy` | ok — 182 handlers |
| Unit | 198 passed, the 11 pre-existing failures unchanged |
| `e2e/profile-governance.spec.ts` | 3 passed (one order-dependent flake on `:81` in a mixed run, green on its own and on the file re-run) |
| `e2e/team.spec.ts` | `:12` expects the old staff-page heading (P10 update); `:26` is the Last-active day-boundary flake; the other four pass |
| tsc | 109 = after P8 (the two narrowed-comparison errors introduced by the front-desk early return fixed) |
| Lint | delta 0 on every touched file; `staff-files.tsx` 25 → 12 |

Files: `src/components/profile/{documents-tab.tsx, front-desk-view.tsx}` (new), `src/lib/staff-file-storage.ts` (new), `src/components/profile/{staff-profile-page.tsx, profile-helpers.ts, profile-types.ts}`, `src/components/staff-files.tsx`, `src/lib/clinic.functions.ts`, `src/lib/clinic.functions.demo.ts`, `src/routes/_authenticated/{profile.tsx, team.$id.tsx}`, five components removed, captures under `captures/p9-documents-frontdesk/`.

> Revised in P10: the documents headline hook is `documents-headline`; the register link has a 24 px tap height.
