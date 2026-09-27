---
name: Portal feedback and metrics layer
overview: Back up e2e_live onto e2e, then implement the owner-view feedback across every clinic-portal page, the mocked-up diary "Needs action" control, and a metrics validation layer (shared definitions, unit invariants, check:metrics guard, rendered-number Playwright spec). Twelve phases ordered from least to most dependent, each with granular to-dos, its own worklog file, and a verify-and-commit step on e2e_live.
todos:
  - id: p0-01-backup-push
    content: "Phase 0: stay checked out on e2e_live; confirm clean tree and e2e_live == origin/e2e_live (a21909d); fast-forward push e2e_live onto e2e using Zaisam's token in the URL (git push https://ghp_...@github.com/legitzaisam/patientsys.git e2e_live:e2e, never via origin, never --force, keychain untouched); fetch; fast-forward the local e2e ref without checking it out; confirm ls-remote shows e2e at a21909d; e2e is now a backup only and all development continues on e2e_live"
    status: completed
  - id: p0-02-baseline
    content: "Phase 0: record baselines: Chromium e2e (126/131 + the five known failures), unit (132/133), tsc (103), test:responsive:gate, non-Prettier lint counts on the files this plan touches"
    status: completed
  - id: p0-03-worklog-scaffold
    content: "Phase 0: create docs/portal-feedback/README.md (index: every bullet of the to-do doc -> phase -> status) and docs/portal-feedback/worklog/00-backup-and-baseline.md; fix the worklog template (Scope, Changes per item with files, Verification, Captures, Notes)"
    status: completed
  - id: p1-01-dev-notes
    content: "Phase 1: remove or gate developer notes: security-settings demo hint, comms-preferences 'Nothing is emailed…', comms-log subtitle / Process queue / sandbox / attempts behind a showDiagnostics prop (admin only), retail 'No cart', integrations card moved to the software-admin /access surface"
    status: completed
  - id: p1-02-dev-notes-e2e
    content: "Phase 1: update e2e/comms.spec.ts and e2e/offers.spec.ts so the outbox drain is exercised as admin (or via the demo drain) instead of the hidden 'Process queue' button"
    status: completed
  - id: p1-03-team-subtitle
    content: "Phase 1: team.index.tsx subtitle: 'You're the clinic owner' for owners, 'You hold manager access' for managers"
    status: completed
  - id: p1-04-receptionist
    content: "Phase 1: 'Receptionist' in every user-facing string (role-switcher, dashboard heading, invite-staff-dialog baseline, staff-alert-dialog and share-note-button 'Reception', demo note bodies); front_desk key untouched"
    status: completed
  - id: p1-05-benchmarks
    content: "Phase 1: remove the four made-up benchmark strings from insights/patient-metrics.tsx"
    status: completed
  - id: p1-06-marketing-subtoggles
    content: "Phase 1: comms-preferences.tsx: marketing email/text sub-toggles disabled and dimmed while Marketing is off"
    status: completed
  - id: p1-07-insights-wording
    content: "Phase 1: Insights wording: 'Sign-ups' -> 'Online enquiries' (tiles + chart), drop 'not a recall list', one-line 'Needs a next step' description, 'ranked by revenue' on What sold, 'Book' tab -> 'Patient base' (insights.tsx + access-catalogue label)"
    status: completed
  - id: p1-08-retention-performance-wording
    content: "Phase 1: Retention 'These get more accurate as your clinic's data grows.', one-line Revenue at risk explainer, action words matching dashboard tasks; Performance 'Details' instead of '{name}'s extras', 'How to read this' -> info icon popover beside the headings"
    status: completed
  - id: p1-09-profile-security-wording
    content: "Phase 1: security-settings: 'We'll email you a code first to confirm it's you', 'This device'; profile.tsx work email hint 'Ask the clinic owner to change this'"
    status: completed
  - id: p1-10-medical-history-tab
    content: "Phase 1: 'History updates' -> 'Medical history' in patients.$id.tsx, access-catalogue.ts, permissions.ts (key view.patients.history kept); update e2e/patients.spec.ts and e2e/responsive/pages.ts; Offers card above Contact preferences"
    status: completed
  - id: p1-11-dashboard-wording
    content: "Phase 1: today-snapshot 'Session N · treatment' instead of '#N'; journey card text on two lines; remove the sidebar 'Diary N' badge in app-shell.tsx"
    status: completed
  - id: p1-12-format-helpers
    content: "Phase 1: src/lib/format.ts: moneyWhole (no pence at or above £1,000; pence on individual payments), dateTime (no seconds), daysAgoLabel ('today' / 'yesterday' / 'N days ago'), displayName(patient, { surnameFirst }); apply at the listed call sites"
    status: completed
  - id: p1-13-journey-phases
    content: "Phase 1: one src/lib/journey-phases.ts replacing the duplicated phase names and subtitles in patients/journey-board.tsx and dashboard/treatment-journeys.tsx"
    status: completed
  - id: p1-14-confirmations
    content: "Phase 1: AlertDialog confirmations on Remove team member, role change, Archive offer template (replacing window.confirm), delete message template, Settings treatment/product archive; patient Archive dialog adds 'starts the 8-year retention clock'"
    status: completed
  - id: p1-15-unsaved-guard
    content: "Phase 1: src/hooks/use-unsaved-changes.ts (TanStack useBlocker + beforeunload) on the profile form, team member profile, clinic details and offer editor"
    status: completed
  - id: p1-16-shell-polish
    content: "Phase 1: butter ring on the four toolbar icon buttons; sidebar Team list scrolls in its own box with a 'See all' link; one caption per follow-up list stating its job (dashboard today/this week, Insights new patients, Retention existing patients)"
    status: completed
  - id: p1-17-loading-states
    content: "Phase 1: dashboard kpi-grid, today-snapshot, attention-list, treatment-journeys render skeletons while loading and a 'Couldn't load' line with Retry on error; never '0' or '£0'"
    status: completed
  - id: p1-18-list-labels
    content: "Phase 1: patients.index.tsx DOB placeholder -> 'Date of birth'; 'Select all' label carries the matching count"
    status: completed
  - id: p1-19-verify-commit
    content: "Phase 1: unit, e2e (patients, comms, offers, team, smoke, rbac), tsc delta 0, lint delta 0; commit; worklog/01-wording-and-consistency.md"
    status: completed
  - id: p2-01-deposit-settings
    content: "Phase 2: migration clinics.deposit_lead_days (3) and deposit_percent (30) + demo clinic row; Settings 'Payments and deposits' tab (owner/manager) editing both; server fn + validator + policy entry"
    status: completed
  - id: p2-02-details-incomplete
    content: "Phase 2: migration appointments.details_incomplete + demo; Quick book sets it; editing the booking clears it"
    status: completed
  - id: p2-03-task-due-at
    content: "Phase 2: migration recall_tasks.due_at + demo; create dialogs default to +7 days and let the user edit; listOpenRecallTasks returns it"
    status: completed
  - id: p2-04-profile-compliance-fields
    content: "Phase 2: migration profiles.registration_body, registration_expiry, insurance_provider, insurance_expiry, qualifications + demo rows; validators and staff profile server fn extended"
    status: completed
  - id: p2-05-capability-keys
    content: "Phase 2: new keys reports.commission (owner only by default) and patients.edit (manager and practitioner on, receptionist off) in permissions.ts, access-catalogue.ts, a seeding migration and demo rolePermissions; visible in the access grid"
    status: completed
  - id: p2-06-defaults-review
    content: "Phase 2: access defaults: Receptionist loses Insights and Treatments & colours and view.patients.history / view.patients.portal; Practitioner gains Insights; Manager gains Design and automate offers; update tests/unit/access-catalogue.test.ts and permissions.test.ts expectations"
    status: completed
  - id: p2-07-permission-audit
    content: "Phase 2: setRolePermission writes audit_log via audit() (demo auditLog array); access grid shows 'changed by X on date' for each key"
    status: completed
  - id: p2-08-offer-rules-schema
    content: "Phase 2: migration offer_templates.applies_to_catalogue_ids, one_per_patient, no_stacking + demo; editor fields; enforcement lands in Phase 11"
    status: completed
  - id: p2-09-policy-fixes
    content: "Phase 2: POLICY listAccountsMissingEmail -> manager (demo twin authorizes too); archivePatient -> manager"
    status: completed
  - id: p2-10-pagination-component
    content: "Phase 2: src/components/pagination-bar.tsx + usePagination hook (first/prev/next/last, page size, 'Showing a–b of N') built on ui/pagination.tsx; first consumer is the Settings treatments list (10 per page, 'Show archived')"
    status: completed
  - id: p2-11-settings-tabs
    content: "Phase 2: Settings tabs Clinic / Treatments / Products / Payments and deposits / Integrations; reset-colour icon hidden when the colour is the default; retail 'Archive' as text"
    status: completed
  - id: p2-12-verify-commit
    content: "Phase 2: check:policy, check:validators, check:tenancy, unit, e2e (rbac, team, settings paths in smoke), tsc; commit; worklog/02-schema-keys-settings.md"
    status: completed
  - id: p3-01-definitions
    content: "Phase 3: src/lib/metrics/definitions.ts: nextDueFor (latest treatment carrying a due date), hasUpcomingBooking, dueState -> booked | overdue | due_soon | lapsing | lost | none, visitCount, oneVisitOnly(population), firstToSecond(rows, window, 180)"
    status: completed
  - id: p3-02-appointment-flags
    content: "Phase 3: src/lib/metrics/appointment-flags.ts: unpaid, deposit_due (lead days from settings), consent_due, running_late (phaseOf moved out of arrival-alerts.tsx), details_incomplete, no_show; arrival-alerts imports it"
    status: completed
  - id: p3-03-money
    content: "Phase 3: src/lib/metrics/money.ts: per-treatment earned / collected / outstanding via treatments.appointment_id and the deposit percent; bookedAhead for future bookings; practitioner share helpers"
    status: completed
  - id: p3-04-windows
    content: "Phase 3: src/lib/metrics/windows.ts and period-picker.tsx: '1y' = rolling 12 months ending today, headings 'Last 7 days / Last month / Last 6 months / Last 12 months', active pill always highlighted, monthBuckets never past now; update tests/unit/period-picker.test.ts"
    status: completed
  - id: p3-05-snapshot
    content: "Phase 3: src/lib/metrics/snapshot.ts: metricsSnapshot(rows, now, identity) producing every headline number by page and role (dashboard, patients, record, insights, retention, performance, earnings, offers, portal plan)"
    status: completed
  - id: p3-06-definition-tests
    content: "Phase 3: tests/unit/metrics-definitions.test.ts: booked patient never due, overdue with no cut-off, deposit counts 30%, Earned = Collected + Outstanding, rolling window boundaries, f2s horizon and 'too early' cohorts"
    status: completed
  - id: p3-07-invariants
    content: "Phase 3: vitest.metrics.config.ts (defines __DEMO_MODE__ and a pinned __DEMO_NOW__) and tests/unit/metrics-consistency.test.ts over the real demo db asserting the cross-page invariants (dashboard = retention, insights = retention, earned = collected + outstanding, offers = one-visit minus booked minus on-plan, list pill = record items, sidebar badge = today's diary, no future buckets, portal plan = clinic plan); UI-wired invariants marked todo until Phase 7"
    status: completed
  - id: p3-08-check-metrics
    content: "Phase 3: scripts/check-metrics.mjs runs the metrics config and prints a reconciliation table (page · metric · value · matches); npm run check:metrics, added to verify"
    status: completed
  - id: p3-09-verify-commit
    content: "Phase 3: unit suites green (policy-scope failure unchanged); tsc; commit; worklog/03-metrics-module.md"
    status: completed
  - id: p4-01-retention-builder
    content: "Phase 4: retention.server.ts onto metrics: at-risk rows and counts (overdue no longer capped at 180 days), one visit only over the window, cohort table with H = 180, next due from the latest treatment"
    status: completed
  - id: p4-02-insights-builder
    content: "Phase 4: insights.server.ts onto metrics: composition by visit count (fixes 'Two or more'), first-to-second, consulted patients removed from 'Waiting for a first booking', no future month buckets, buildBookMetrics takes a window"
    status: completed
  - id: p4-03-earnings-builder
    content: "Phase 4: earnings.server.ts onto metrics: buildStats money model, treatments completed in the period, bookedAhead, buildTrend fed by the page window (daily ≤ 62 days, else monthly)"
    status: completed
  - id: p4-04-offers-builder
    content: "Phase 4: offers/cohorts.ts and stages.ts derive stage facts from dueState / visitCount / hasUpcomingBooking"
    status: completed
  - id: p4-05-dashboard-builder
    content: "Phase 4: getDashboard (clinic.functions.ts and .demo.ts): KPIs and attention items from metrics; deposit lead days from settings; treatmentsDue = overdue + dueSoon over the no-booking population; to chase = retention at-risk"
    status: completed
  - id: p4-06-listpatients-builder
    content: "Phase 4: listPatients (prod and demo): nextDue from the latest treatment (fixes the Finn Thornhurst row), openTasks from metrics, server-side filters for 'Treatments due' and 'No upcoming treatment'"
    status: completed
  - id: p4-07-labels-and-chips
    content: "Phase 4: every window named on the surface ('Next 30 days', 'Last 12 months'), every percentage chip says its comparison ('+27 pts vs last year', 'vs last month'), Performance shows the 'Booked ahead' line, dashboard retention card loses its change chip"
    status: completed
  - id: p4-08-e2e-labels
    content: "Phase 4: update e2e/feedback-corrections.spec.ts (:57 period labels, :137 KPI copy) and any spec asserting 'This year' / '1 year'"
    status: completed
  - id: p4-09-verify-commit
    content: "Phase 4: check:metrics green (UI-wired invariants still todo), unit, full Chromium e2e (known failures only), tsc, test:responsive:gate; commit and push (Before-2-October complete); worklog/04-definitions-applied.md"
    status: completed
  - id: p5-01-needs-action-control
    content: "Phase 5: src/components/schedule/needs-action-control.tsx per the mockup: pill beside 'View by', main button toggles Everything outstanding, caret menu with Unpaid / Deposit due / Consent due / Running late / Details incomplete and counts, Clear link, green 'All clear' at zero, hint line, footer 'To chase these, open Attention needed on the dashboard'; data-qc hooks"
    status: completed
  - id: p5-02-day-view-filtering
    content: "Phase 5: day view: matching cards keep place and gain the rose ring and tag chips, the rest fade to opacity .28 and desaturate; flags from metrics/appointment-flags with a one-minute tick for running late"
    status: completed
  - id: p5-03-week-month
    content: "Phase 5: the same control on the week view; month cells show a needs-action count badge only"
    status: completed
  - id: p5-04-colour-key
    content: "Phase 5: src/components/schedule/colour-key.tsx under the timetable from the treatment lane colours (LANE_LABELS + treatment colours)"
    status: completed
  - id: p5-05-own-diary-default
    content: "Phase 5: practitioners open the diary on their own column (dayPractitioner seeded from identity); 'All practitioners' still available"
    status: completed
  - id: p5-06-tap-popover
    content: "Phase 5: on touch devices a tap on an appointment opens the hover card as a controlled popover (pointerType pattern from the stage badge)"
    status: completed
  - id: p5-07-clinic-time
    content: "Phase 5: getPractitionerDay uses clinic-time (Europe/London) instead of the server clock"
    status: completed
  - id: p5-08-details-chip
    content: "Phase 5: 'Details incomplete' chip on Quick book appointments in day/week cards and dashboard cards; cleared when edited"
    status: completed
  - id: p5-09-verify-commit
    content: "Phase 5: e2e schedule, reminders, treatment-workflow; responsive schedule pages gain a needs-action-open state and re-run for iPhone/iPad/1366; commit; worklog/05-diary.md"
    status: completed
  - id: p6-01-list-pagination
    content: "Phase 6: patients.index.tsx paginates 25 per page with PaginationBar (first/prev/next/last); URL keeps the page"
    status: completed
  - id: p6-02-list-filters
    content: "Phase 6: filters All / Active / Inactive / Treatments due / No upcoming treatment (server-side from Phase 4); counts on chips"
    status: completed
  - id: p6-03-select-all
    content: "Phase 6: 'Select patients to send an offer' hint; 'Select all N matching' selects across pages; selection survives paging"
    status: completed
  - id: p6-04-columns
    content: "Phase 6: Next treatment column shows the date; surname-first names in this table only via displayName; open-tasks pill links to /patients/$id?tab=treatments#recall"
    status: completed
  - id: p6-05-practitioner-default
    content: "Phase 6: practitioners land on 'My patients'; owners see lifetime spend on the record header (wired in Phase 7)"
    status: completed
  - id: p6-06-offer-warning
    content: "Phase 6: Send offer from the list warns 'N of M haven't opted into marketing, so they'll see it in their portal only' (describeOfferChannels); a sent offer closes that patient's open recall tasks (send.ts + demo)"
    status: completed
  - id: p6-07-board
    content: "Phase 6: journey board: Book button on 'No upcoming booking' / overdue cards opening Quick book pre-filled; dashboard late-bar colour rule; at-risk cards first in each column; 'Due 28 Sep' / 'Booked 28 Sep' labels"
    status: completed
  - id: p6-08-verify-commit
    content: "Phase 6: e2e patients, offers (list send), feedback-corrections; responsive patients / patients-board; commit; worklog/06-patients-list-and-board.md"
    status: completed
  - id: p7-01-record-header
    content: "Phase 7: record header keeps Record treatment, adds Open chat with an unread badge; Send form, Send offer, Archive move into a ⋯ DropdownMenu; owner lifetime spend line; last-seen wording"
    status: completed
  - id: p7-02-remove-chat-panel
    content: "Phase 7: remove the record's side chat panel; registerChatPage docked:false so the dock bubble shows on this page; Open chat and ?chat=1 open the floating window on this patient"
    status: completed
  - id: p7-03-badge-and-recall
    content: "Phase 7: Treatments tab badge means open booking items and says so (tooltip); Recall tasks card lists the same open items as the list pill, drops the 'Assign one from the Retention page' sentence, owner/manager can assign (#recall anchor)"
    status: completed
  - id: p7-04-plan-card
    content: "Phase 7: Treatment plan card at the top of the Treatments tab (#plan) from the plan/milestone rows the board uses: sessions done/total, next milestone, due; journey cards deep-link here"
    status: completed
  - id: p7-05-who-sees-what
    content: "Phase 7: Documents tab shows signed/due status only for receptionists; Archive available to managers; edit actions gated by patients.edit; Medical history and From the patient hidden by the Phase 2 defaults"
    status: completed
  - id: p7-06-verify-commit
    content: "Phase 7: e2e patients, treatment-workflow, patient-portal sync (chat), responsive patient-record states (menu open); the UI-wired invariants flip from todo to asserted; commit; worklog/07-patient-record.md"
    status: completed
  - id: p8-01-card-order
    content: "Phase 8: dashboard card order for owners: numbers, short Attention summary, today's diary, journeys, tasks"
    status: completed
  - id: p8-02-week-strip
    content: "Phase 8: week-view summary strip for owner and manager above the cards: appointments per day, £ booked, fullness per practitioner (09:00–18:00 until real hours exist)"
    status: completed
  - id: p8-03-journeys-links
    content: "Phase 8: journey cards link to /patients/$id?tab=treatments#plan; two-line text verified"
    status: completed
  - id: p8-04-tasks
    content: "Phase 8: My tasks rows show due date and assignee"
    status: completed
  - id: p8-05-kpi-links
    content: "Phase 8: every KPI number links to its list (/patients?filter=due, /retention, /patients/board, overdue steps -> board at-risk)"
    status: completed
  - id: p8-06-deposit-copy
    content: "Phase 8: the Attention deposit rule sentence reads the lead days from settings"
    status: completed
  - id: p8-07-week-server-filter
    content: "Phase 8: practitioners' week view filtered on the server like day view (getDashboard week span)"
    status: completed
  - id: p8-08-verify-commit
    content: "Phase 8: e2e feedback-corrections, treatment-workflow, smoke; responsive dashboard; commit; worklog/08-dashboard.md"
    status: completed
  - id: p9-01-patient-base
    content: "Phase 9: Insights 'Patient base' tab with the period picker; last-visit buckets (<3, 3–6, 6–12, 12+ months) replace the active/inactive donut"
    status: completed
  - id: p9-02-pipeline-lists
    content: "Phase 9: next-step lists return full sets and paginate 10 per page with PaginationBar; same days-waiting format in both; 'Schedule' action on the Consulted list"
    status: completed
  - id: p9-03-chart-palette
    content: "Phase 9: chart palette from the brand pastel tokens with projector-safe contrast; 'What sold' removed from Insights (lands on Performance in Phase 10)"
    status: completed
  - id: p9-04-atrisk-table
    content: "Phase 9: at-risk table pins the patient column (sticky left), drops the practitioner column; Send recall dialog gains 'Assign to' reusing staff-task-hovercard"
    status: completed
  - id: p9-05-cohort
    content: "Phase 9: cohort table: current month 'Too early', cohorts under 180 days 'N% so far' muted; y-axis in %"
    status: completed
  - id: p9-06-verify-commit
    content: "Phase 9: e2e retention, feedback-corrections; responsive insights / retention; check:metrics; commit; worklog/09-insights-and-retention.md"
    status: completed
  - id: p10-01-performance-period
    content: "Phase 10: Performance: trend pills removed, trends follow the page period; both series drawn; expanded-row trend fits (min-w-0)"
    status: completed
  - id: p10-02-commission-gating
    content: "Phase 10: money totals, commission and 'to them' behind reports.commission; a manager without it sees counts, attendance and retention"
    status: completed
  - id: p10-03-retail-what-sold
    content: "Phase 10: Performance gains retail revenue share and the What sold card"
    status: completed
  - id: p10-04-my-earnings
    content: "Phase 10: My earnings: 'Your share' naming, every card in share terms or labelled, hidden for owners with no treatments in 12 months, commission rate, payout status (paid / pending), CSV export and print-to-PDF, distinct icons, Year total clears the dock"
    status: completed
  - id: p10-05-my-profile
    content: "Phase 10: My profile: performance block becomes a summary + 'See my earnings'; active period highlighted; registration body dropdown (GMC, NMC, GPhC, GDC, HCPC, None) plus expiry, insurance and qualifications fields; owner Attention row when an expiry is within 60 days; Security and Documents as tabs above the heading"
    status: completed
  - id: p10-06-verify-commit
    content: "Phase 10: e2e feedback-corrections:137, rbac (manager money), smoke; responsive performance / earnings / profile; check:metrics; commit; worklog/10-performance-earnings-profile.md"
    status: completed
  - id: p11-01-team-columns
    content: "Phase 11: Team list shows last active, compliance status (staff-doc-compliance), commission rate (owner); 'Team & staff details' description matches the toggle; permission 'changed by' notes visible"
    status: completed
  - id: p11-02-offers-cards
    content: "Phase 11: single one-off template card spans full width when alone; stage cards labelled with their subset ('Single treatment, not booked, no plan'); switching a stage on confirms 'N patients will get this now, M by portal only'"
    status: completed
  - id: p11-03-offer-results-rules
    content: "Phase 11: results per offer (sent -> claimed -> booked -> £ revenue); rules enforced in offers/send.ts (applies-to treatments, one per patient, no stacking); pre-consultation delay editable on the card"
    status: completed
  - id: p11-04-verify-commit
    content: "Phase 11: e2e offers, team; responsive offers / team; check:metrics; commit; worklog/11-team-and-offers.md"
    status: completed
  - id: p12-01-metric-hooks
    content: "Phase 12: data-qc=\"metric:<id>\" on every rendered number in both portals (KPI cards, chips, badges, table counts, portal plan and appointment figures)"
    status: completed
  - id: p12-02-rendered-spec
    content: "Phase 12: src/routes/api/demo/metrics.ts (DEMO only) returning metricsSnapshot; playwright.metrics.config.ts with its own webServer and pinned DEMO_NOW; e2e/metrics/rendered.spec.ts visits every page as owner, manager, practitioner, receptionist, patient and asserts each metric:* text equals the snapshot; npm run test:metrics"
    status: completed
  - id: p12-03-review-pack
    content: "Phase 12: e2e/review/feedback-captures.spec.ts (Chromium 1440, WebKit iPad Mini, iPhone 15) -> docs/portal-feedback/captures/*.jpg and docs/portal-feedback/REVIEW.md mapping every doc bullet to done / follow-on with its capture"
    status: completed
  - id: p12-04-full-verify
    content: "Phase 12: check:policy, check:validators, check:tenancy, check:metrics, unit, Chromium e2e, test:metrics, test:responsive:gate at major, tsc delta 0, lint delta 0"
    status: completed
  - id: p12-05-ship
    content: "Phase 12: finish README index and worklog/12-validation-and-review.md; commit and push e2e_live with the token URL"
    status: completed
isProject: false
---

# Clinic portal feedback, diary Needs-action filter, metrics validation layer

Sources: `Claude outputs/Aetheria clinic portal owner view to-do.md`, `Claude outputs/diary-status-filter-mockup.html`. Scope agreed: Before-2-October items, every per-page fix, the diary control and the validation layer; large features go to a follow-on phase (listed at the end). The Attention-needed chase list is out.

## Branch and credentials (applies to every phase)

- All development happens on `e2e_live`, which stays checked out for the whole plan. `e2e` receives one fast-forward push at the start of Phase 0 as a backup of everything built so far and is not touched again by this plan (no checkout, no commits, no further pushes to it unless you ask).
- Every push uses Zaisam's token in the remote URL: `git push https://<ZAISAM_TOKEN>@github.com/legitzaisam/patientsys.git <refspec>`. Never `git push origin …` (that would go through the macOS keychain credential), never `--force`, never rebase, amend or squash anything already pushed (Lovable-connected repo).
- Commits carry the existing author identity: `git -c user.name="$(git log -1 --format=%an)" -c user.email="$(git log -1 --format=%ae)" commit …`. `.cursor/`, `Claude outputs/` and `.tmp-*.mjs` are never committed.

## Decisions taken (from the two question rounds)

- Due / overdue / to chase: only active patients with no upcoming booking count. Due soon = next due within 30 days; Overdue = next due in the past (no 180-day cut-off; Lapsing/Lost become a days-since-last-visit breakdown of the same people). To chase = Overdue + Due soon + lapsing/lost without a due date. Dashboard "Treatments due" = Overdue + Due soon.
- One visit only / Treated once: exactly one treatment visit ever (any type), population = patients seen in the selected period; the Insights Book tab gains the period picker.
- First-to-second: of patients whose first visit was in the period and at least 180 days ago, share with a second visit within 180 days. One function for Insights, Retention and the cohort table.
- "1 year" preset = rolling 12 months ending today, heading "Last 12 months", on every picker; affected e2e expectations are updated.
- Money: Earned = value of treatments performed in the period; Collected = the paid part of that value (full payment in full, deposit at its 30%); Outstanding = Earned − Collected. Future-booking money is a separate "Booked ahead" line. My earnings shows the practitioner's share of each and is renamed "Your share".
- Names: "Grace Adeyemi" in prose and cards; surname-first only in the sortable Patients table; title only on the record header.
- Diary Needs action applies to day and week views; month shows counts only.
- Patients list pagination 25 per page; Insights lists and Settings treatments 10 per page; Select all selects all matching across pages.
- "What sold" and retail share move to Performance. My earnings hidden for an owner with no treatments as practitioner in the last 12 months. iPad: tap opens the desktop hover card as a popover.
- Validation layer: all four layers (shared definitions, unit invariants, check:metrics guard, rendered-number e2e).

## Interpretations to confirm at review (small items the doc leaves open)

- "Yellow outline to the icons on header" = a butter ring (`ring-1 ring-accent`) on the four toolbar icon buttons in `src/components/app-shell.tsx`, always on.
- "Journey tab" on the record: the record has no plan view, so journey cards deep-link to a new Treatment plan card at the top of the Treatments tab (`/patients/$id?tab=treatments#plan`), built from the plan/milestone rows the board already uses.
- Recall task "due date" = new nullable `due_at` column (migration + demo), defaulting to 7 days after creation, editable when creating; "owner" = assignee.
- Quick book "details incomplete" = new `details_incomplete` flag (migration + demo) set by Quick book, cleared on edit; shown as a chip and as a fifth Needs-action type.
- Access defaults: Receptionist loses Insights and Treatments & colours; Practitioner gains Insights; Manager gains Design and automate offers. New keys: `patients.edit` (manager and practitioner on, receptionist off) and `reports.commission` (owner only by default; a manager without it sees counts, attendance and retention on Performance, never money).
- Receptionist "medical alert flag without details": follow the who-sees-what table instead (receptionist sees allergies, medication, conditions); receptionist loses Medical history and From the patient by default; Documents shows signed/due status only; Archive opens to owner and manager.
- Cohort table with H = 180: cohorts younger than six months show "N% so far" in muted type; the current month shows "Too early".
- Offer results: booked = a non-cancelled appointment created after the claim; revenue = treatments performed for that patient after the claim within validity + 90 days.
- Settings tabs are created only for what exists (Clinic, Treatments, Products, Payments and deposits, Integrations); Payments and deposits is new because the dashboard deposit rule must read from it (`deposit_lead_days`, `deposit_percent` on `clinics`).
- Week-view fullness uses 09:00–18:00 until real working hours exist (follow-on).
- Timestamps become date + HH:mm; "Last seen today / yesterday / N days ago".

## Phase order and dependencies

Phases run from the least dependent to the most dependent. Each phase ends with a verify step, one commit on `e2e_live`, and its own worklog file.

```mermaid
flowchart TD
  P0[P0 Backup to e2e, baseline, worklog scaffold]
  P1[P1 Wording, dev-note removal, confirmations, formatting]
  P2[P2 Schema, permission keys, Settings surfaces, pagination component]
  P3[P3 Metrics module and invariants]
  P4[P4 Definitions applied to builders and pages]
  P5[P5 Diary]
  P6[P6 Patients list and journey board]
  P7[P7 Patient record]
  P8[P8 Dashboard]
  P9[P9 Insights and Retention]
  P10[P10 Performance, My earnings, My profile]
  P11[P11 Team and Offers]
  P12[P12 Rendered-number e2e, review pack, final verify]
  P0 --> P1
  P0 --> P2
  P0 --> P3
  P2 --> P4
  P3 --> P4
  P2 --> P5
  P3 --> P5
  P4 --> P6
  P1 --> P7
  P6 --> P7
  P7 --> P8
  P4 --> P9
  P2 --> P9
  P4 --> P10
  P2 --> P10
  P2 --> P11
  P4 --> P11
  P8 --> P12
  P9 --> P12
  P10 --> P12
  P11 --> P12
```

## Worklog per phase

`docs/portal-feedback/README.md` is the index: every bullet of the to-do doc, the phase that handles it, and its status (done / follow-on / declined with reason). Each phase writes `docs/portal-feedback/worklog/NN-<phase>.md` with the same template:

- Scope: the doc bullets covered, quoted.
- Changes: one entry per item: files touched, what changed and why, migration or demo parity if any.
- Verification: the exact commands run and their results (counts, deltas), and which e2e expectations were updated and why.
- Captures: paths of the screenshots taken for the item (from Phase 5 onwards, using the responsive config).
- Notes: anything left, any interpretation made, anything for the follow-on phase.

## Architecture of the validation layer

```mermaid
flowchart LR
  demoDb[Demo fixture db] --> builders
  supabase[Supabase rows] --> builders
  subgraph metrics [src/lib/metrics]
    defs[definitions: dueState, visitCounts, firstToSecond, appointmentFlags]
    money[money: earned, collected, outstanding, bookedAhead]
    windows[windows: rolling presets, no future buckets]
    snapshot[snapshot: every headline number by page and role]
  end
  builders[retention.server, insights.server, earnings.server, offers/cohorts, getDashboard, listPatients] --> defs
  builders --> money
  builders --> windows
  snapshot --> unit[tests/unit/metrics-consistency.test.ts]
  unit --> check[npm run check:metrics reconciliation table]
  snapshot --> api["/api/demo/metrics (DEMO only)"]
  api --> e2e[e2e/metrics/rendered.spec.ts reads data-qc metric:* text]
```

Every page computes through the same functions (production and demo paths both call the shared builders already; `getDashboard` and `listPatients` inline their maths today and are moved onto the module). Every rendered number gets `data-qc="metric:<id>"` so the e2e spec can compare the DOM with the snapshot.

## Phase 0: backup to e2e, baseline, worklog scaffold (no product code)

- Backup: stay on `e2e_live`; confirm the tree is clean and `e2e_live` matches `origin/e2e_live` (`a21909d`); `git push https://<ZAISAM_TOKEN>@github.com/legitzaisam/patientsys.git e2e_live:e2e` is a fast-forward from `94fc1b6` (Zaisam's token in the URL, keychain untouched, no force, no history rewrite); `git fetch` with the same URL and `git branch -f e2e origin/e2e` to move the local `e2e` ref without checking it out; confirm with `git ls-remote` that `e2e` is at `a21909d`. From here `e2e` is the backup and every commit in Phases 1–12 lands on `e2e_live`.
- Baseline: full Chromium e2e (126/131 with the five known failures listed), unit (132/133, `policy-scope`), `tsc` (103), `test:responsive:gate`, non-Prettier lint counts on the files this plan touches. Recorded in `worklog/00-backup-and-baseline.md`.
- Scaffold `docs/portal-feedback/README.md` with the full bullet index (all rows "pending" and their phase) and the worklog template.

## Phase 1: wording, dev-note removal, confirmations, formatting (depends on nothing)

Everything here is string, style or dialog work with no data dependency, so it goes first and de-risks the rest.

- Dev notes: `src/components/security-settings.tsx:192`, `src/components/comms/comms-preferences.tsx:61`, `src/components/comms/comms-log.tsx` (subtitle, "Process queue", provider "sandbox", attempts behind a new `showDiagnostics` prop passed as `identity.isAdmin` from `patients.$id.tsx:694`), `src/components/retail-product-settings.tsx:86`, `src/components/insights-integrations-settings.tsx` moved to the software-admin `/access` surface. `e2e/comms.spec.ts` and `e2e/offers.spec.ts` drive the drain as admin.
- Team subtitle `team.index.tsx:369`; "Receptionist" in `demo/role-switcher.tsx:9`, `dashboard.tsx:114`, `invite-staff-dialog.tsx:38`, `staff-alert-dialog.tsx:36,44`, `notes/share-note-button.tsx:23`, demo note bodies; benchmarks in `insights/patient-metrics.tsx:60,71,78,191`; marketing sub-toggles in `comms-preferences.tsx`.
- Wording: Insights (`funnel-tiles.tsx:22`, `funnel-chart.tsx`, `insights.tsx:66-148`, `access-catalogue.ts:217`), Retention (`suggested-actions.tsx:54`, `retention.tsx:147`), Performance (`performance-table.tsx:147`, `performance.tsx:102`), Security and Profile (`security-settings.tsx:248,373`, `profile.tsx:182`), record tab rename (`patients.$id.tsx:667`, `access-catalogue.ts:157`, `permissions.ts:139`; `e2e/patients.spec.ts:29`, `e2e/responsive/pages.ts:493`), dashboard "Session N" (`today-snapshot.tsx:593`), sidebar badge (`app-shell.tsx:528-543`).
- `src/lib/format.ts` (`moneyWhole`, `dateTime`, `daysAgoLabel`, `displayName`) applied at `performance.tsx:130`, `retention.tsx:147`, `earnings.tsx:57-65`, `my-performance-kpis.tsx`, `staff-performance-kpis.tsx`, `performance-table.tsx`, `at-risk-table.tsx:430`, `comms-log.tsx:125`, `patients.$id.tsx:434,1251`, `sent-staff-alerts.tsx:51`.
- `src/lib/journey-phases.ts` replaces `journey-board.tsx:35` and `treatment-journeys.tsx:38`.
- `AlertDialog` confirmations (`team.index.tsx:433-468`, `offers.tsx:217`, `message-composer.tsx:233`, Settings archives); `src/hooks/use-unsaved-changes.ts` on the four page forms.
- Header ring, sidebar Team scroll + "See all", list captions, dashboard skeleton and error states, DOB placeholder and Select-all label.
- Verify: unit; e2e patients, comms, offers, team, smoke, rbac; tsc and lint deltas 0. Commit. `worklog/01-wording-and-consistency.md`.

## Phase 2: schema, permission keys, Settings surfaces, pagination component (depends on nothing; many phases depend on it)

- Migrations (nullable, demo parity, `check:validators` and `check:tenancy` green): `clinics.deposit_lead_days` / `deposit_percent`; `appointments.details_incomplete`; `recall_tasks.due_at`; `profiles` registration and insurance fields; `offer_templates` rules; capability seeding for `reports.commission` and `patients.edit`.
- `permissions.ts` and `access-catalogue.ts`: the two new keys, the defaults review, and the audit note; `setRolePermission` writes `audit_log` through `audit()` (demo `auditLog`).
- POLICY: `listAccountsMissingEmail` → `manager` (demo twin authorizes), `archivePatient` → `manager`.
- `src/components/pagination-bar.tsx` + `usePagination` on `ui/pagination.tsx`; Settings tabs; treatments list paginated 10 with "Show archived"; reset icon hidden at default; retail "Archive" as text; Payments and deposits tab.
- Verify: `check:*`, unit (access-catalogue, permissions updated), e2e rbac, team, smoke; tsc. Commit. `worklog/02-schema-keys-settings.md`.

## Phase 3: metrics module and invariants (depends on nothing; Phases 4–12 depend on it)

- `src/lib/metrics/definitions.ts`, `appointment-flags.ts` (with `phaseOf` moved out of `arrival-alerts.tsx`), `money.ts`, `windows.ts`, `snapshot.ts`; `period-picker.tsx` rolling 12 months and headings.
- `tests/unit/metrics-definitions.test.ts` (edge cases) and `tests/unit/metrics-consistency.test.ts` over the real demo `db` through `vitest.metrics.config.ts` (pinned `__DEMO_NOW__`). Invariants: dashboard treatmentsDue = overdue + dueSoon; dashboard overdue = Retention overdue; to chase = Retention at-risk length; Retention oneVisit(window) = Insights treatedOnce(window); composition none + once + twoPlus = population; Insights f2s = Retention headline f2s = cohort weighted average; Earned = Collected + Outstanding per practitioner and in totals; My earnings share = Σ earnedShare; Offers singleTreatment = oneVisit − booked − onPlan; Patients "Treatments due" filter count = dashboard treatmentsDue; each list row's open pill = the record's open items; Treatments tab badge = bookingChase length; sidebar Diary badge = today's appointments; every window ends ≤ now and no chart bucket is in the future; portal plan progress for Olivia = clinic-side plan progress. The UI-wired ones are `todo` until Phase 7.
- `scripts/check-metrics.mjs` and `npm run check:metrics` (in `verify`).
- Verify: unit. Commit. `worklog/03-metrics-module.md`.

## Phase 4: definitions applied to builders and pages (depends on 2 and 3; completes Before-2-October)

- `retention.server.ts`, `insights.server.ts`, `earnings.server.ts`, `offers/cohorts.ts`, `getDashboard` and `listPatients` (prod and demo) onto the module; the Finn Thornhurst next-due fix; server-side "Treatments due" and "No upcoming treatment" filters.
- Surfaces name their window and comparison; Performance "Booked ahead"; dashboard retention card loses its change chip; treatments completed in period on practitioner rows.
- `e2e/feedback-corrections.spec.ts` label updates.
- Verify: `check:metrics`, unit, full Chromium e2e, tsc, `test:responsive:gate`. Commit and push. `worklog/04-definitions-applied.md`.

## Phase 5: Diary (depends on 2.2 and 3.2)

- `src/components/schedule/needs-action-control.tsx` and the day/week/month wiring per the mockup; colour key; own-diary default (`schedule.tsx:327`); tap popover; `getPractitionerDay` (`clinic.functions.ts:2590`) on `clinic-time`; details-incomplete chip.
- Verify: e2e schedule, reminders, treatment-workflow; responsive schedule pages with a `needs-action-open` state. Commit. `worklog/05-diary.md`.

## Phase 6: Patients list and journey board (depends on 2 and 4)

- `patients.index.tsx`: pagination 25, filters, hint, cross-page Select all, Next treatment date, surname-first via `displayName`, pill link, practitioner default; Send offer warning and recall-task closure; board Book button, late colour, at-risk ordering, Due/Booked labels.
- Verify: e2e patients, offers, feedback-corrections; responsive patients and board. Commit. `worklog/06-patients-list-and-board.md`.

## Phase 7: Patient record (depends on 1, 2, 3, 6)

- Header actions and ⋯ menu; Open chat with unread badge; side chat panel removed (`registerChatPage` at `patients.$id.tsx:157` sets `docked: false`); badge semantics; Recall tasks card = open items with Assign to; Treatment plan card (`#plan`); who-sees-what; lifetime spend; last-seen wording.
- Verify: e2e patients, treatment-workflow, patient-portal sync; responsive record states; UI-wired invariants asserted. Commit. `worklog/07-patient-record.md`.

## Phase 8: Dashboard (depends on 2, 3, 4, 7)

- Card order; week summary strip; journey links to `#plan`; My tasks due and assignee; KPI links; deposit copy from settings; server-side week filter.
- Verify: e2e feedback-corrections, treatment-workflow, smoke; responsive dashboard. Commit. `worklog/08-dashboard.md`.

## Phase 9: Insights and Retention (depends on 2, 3, 4)

- Patient base tab with period picker and last-visit buckets; paginated next-step lists with Schedule; palette; What sold removed here; at-risk table sticky column, no practitioner column, Assign to in Send recall; cohort Too early / so far; y-axis %.
- Verify: e2e retention, feedback-corrections; responsive insights and retention; `check:metrics`. Commit. `worklog/09-insights-and-retention.md`.

## Phase 10: Performance, My earnings, My profile (depends on 2, 3, 4)

- Performance single period and two series, expanded-row fit, `reports.commission` gating, retail share and What sold; My earnings "Your share", hide rule, rate, payout status, CSV and print, icons, dock clearance; My profile summary and link, period highlight, registration fields and owner reminder, tabs above the heading.
- Verify: e2e feedback-corrections:137, rbac, smoke; responsive performance, earnings, profile; `check:metrics`. Commit. `worklog/10-performance-earnings-profile.md`.

## Phase 11: Team and Offers (depends on 2, 3, 4)

- Team columns and audit notes; Offers card width, reconciled stage labels, toggle-on preview, results per offer, rules enforced in `offers/send.ts`, delay on the card.
- Verify: e2e offers, team; responsive offers and team; `check:metrics`. Commit. `worklog/11-team-and-offers.md`.

## Phase 12: rendered-number e2e, review pack, final verify (depends on everything)

- `data-qc="metric:<id>"` on every number in both portals; `src/routes/api/demo/metrics.ts` (DEMO only); `playwright.metrics.config.ts` with pinned `DEMO_NOW`; `e2e/metrics/rendered.spec.ts` for five roles; `npm run test:metrics`.
- `e2e/review/feedback-captures.spec.ts` under the responsive config → `docs/portal-feedback/captures/` and `docs/portal-feedback/REVIEW.md` mapping every doc bullet to its status and capture, for sign-off against the doc.
- Full verify: `check:policy`, `check:validators`, `check:tenancy`, `check:metrics`, unit, Chromium e2e (known failures either fixed by the new labels or exactly the pre-existing set), `test:metrics`, `test:responsive:gate` at major, tsc delta 0, lint delta 0. Finish the README index and `worklog/12-validation-and-review.md`. Commit and push `e2e_live`.

## Regression guardrails throughout

- Every renamed string is grepped in `e2e/` and updated in the same commit ("History updates", "Process queue", "sandbox", "This year", "Front desk").
- Existing `data-qc` hooks and e2e selectors are preserved; new controls get new hooks.
- No whole-file reformatting; edits stay surgical; the regression `playwright.config.ts` is untouched (metrics and review runs use their own configs).
- Unit and the affected e2e after every phase; the full stack (e2e, tsc, checks, responsive gate) after Phases 4, 8 and 12; one commit per phase on `e2e_live`, pushed to `origin/e2e_live` with Zaisam's token URL (never via `origin`) at the end of Phases 4 and 12 and any time you ask. `e2e` is not pushed to again after the Phase 0 backup.
- Production stays working: new columns land as nullable migrations with demo parity and `check:validators` / `check:tenancy` green.

## Follow-on phase (not in this plan)

Medical-update review workflow (the doc's top safety item; say if you want the thin slice of badge + notification + Mark reviewed pulled forward), working hours / breaks / leave with diary shading and real `getPractitionerDay` hours, server-side enforcement of the record role table (`getTreatmentRecord`, `getTreatmentSession`, `getAppointmentNote`) and the front-desk clinical seed defaults, the missing Settings (hours, cancellation and no-show policy, rooms, templates, VAT, payment provider, retention period, subscription, audit log view), retail sales against a visit with stock, more offer stages, and the roadmap items.
