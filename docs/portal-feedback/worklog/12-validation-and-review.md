# Phase 12: rendered-number e2e, review pack, final verify

Branch `e2e_live`, on top of `117cce3`. 27 Sep 2026.

## Scope

The fourth validation layer (every rendered number equals the shared snapshot), the review capture pack against the feedback document, the full verification stack, and shipping `e2e_live`.

## Changes

### Rendered-number hooks

`data-qc="metric:<id>"` on the element that holds a number, or `data-metric="<id>"` on a chip whose label starts with one (the chip keeps its `kpi-chip-*` hook):

| Page                | Ids                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | `dashboard.totalClients` (managers), `dashboard.activePlans`, `dashboard.treatmentsDue`; chips `dashboard.toChase`, `dashboard.treatmentsDueSoon`, `dashboard.treatmentsOverdue`               |
| Patients list       | `patients.all / active / inactive / due / nobooking` on the filter pills (My patients is not hooked: its scope is "treated or booked", the snapshot's is "treated")                            |
| Retention           | `retention.oneVisitOnly`                                                                                                                                                                      |
| Insights (Patient base) | `insights.composition.never / once / twoPlus`                                                                                                                                             |
| Performance         | `performance.earned` (total card and clinic row), `performance.collected`, `performance.outstanding`, `performance.bookedAhead`; per row `performance.practitioner.<userId>.earned / earnedShare / treatments` |
| My earnings         | `earnings.share`, `earnings.collected`, `earnings.treatments`                                                                                                                                 |
| Offers              | `offers.stage.<stage>` on the four cards; `offers.results.<templateId>.sent / claimed / booked / revenue` on every template                                                                     |
| Patient portal      | `portal.planDone`, `portal.planTotal` on the home plan card                                                                                                                                   |

### Snapshot and route

- `src/lib/metrics/snapshot.ts`: `dashboard.noUpcomingBooking` (everyone whose state is not "booked", as the list counts), `activePlans` scoped to the plans a practitioner leads (matching `getDashboard`), `insights.neverTreated` (the whole book, as Insights shows it), `offers.results` per template (`offerResults` over the fixture's offers; rows gain `offers`, appointments gain `created_at`, plans gain `practitioner_id`), and `portal` (the patient's active-plan progress through `planProgress`) when `patientId` is given. `demo-rows.ts` supplies the new columns.
- `src/routes/api.demo.metrics.ts`: `GET /api/demo/metrics?practitioner=&patient=|patientUser=` — demo only (404 otherwise); computes the snapshot at the server's clock over the trailing 12 months the pages open on.
- `tests/metrics/consistency.test.ts`: the two P12 `todo`s (getDashboard and listPatients against the snapshot) are now asserted by the rendered spec, so the suite reads 16 passed, 0 todo.

### `npm run test:metrics`

`playwright.metrics.config.ts` (port 8093, own web server with `DEMO=1` and a pinned `DEMO_NOW` so the fixture is the same every run; override with `DEMO_NOW=…`). `e2e/metrics/rendered.spec.ts` visits, per persona, every page that carries a hook — owner (dashboard, patients, retention, insights, performance, offers), software admin (dashboard, patients, performance, offers), practitioner (dashboard, patients, insights, earnings), receptionist (dashboard, patients), patient (my-record) — collects every hooked number, fetches the snapshot (practitioner-scoped for the practitioner's own pages, clinic-wide for the Patients list and Insights), and asserts two things: every hooked id has a snapshot promise, and the rendered number equals it. 17 / 17. The demo has no manager persona; the software admin stands in for the fifth staff view and the manager path is the same code with `reports.commission` off (P10).

Two mismatches the spec caught while being written, both fixed in the snapshot rather than the page: a practitioner's Active skin plans counts the plans they lead, and Insights' "Never treated" is the whole book's count.

### Review pack

`playwright.review.config.ts` (port 8092; Chromium 1440×1400, iPad Mini and iPhone 15 in WebKit) runs `e2e/review/feedback-captures.spec.ts`: 21 scenes — owner dashboard, practitioner dashboard, receptionist dashboard, diary day, diary with Needs action open, diary week, patients list, journey board, patient record and its Treatments tab, retention, insights (both tabs), performance, my earnings, my profile, offers and the switch-on dialog, team, settings, portal home — as full-page JPEGs under `docs/portal-feedback/captures/<scene>--<device>.jpg` (63 files, ~10 MB), with the demo persona switcher and the floating dock hidden (`data-qc="demo-role-switcher"` added for that). The last test writes `docs/portal-feedback/REVIEW.md`: the status tally, the scene table, and every one of the 145 bullets with its status, phase, note and the captures for its section. `npm run review:captures`.

`playwright.config.ts` ignores `e2e/metrics` and `e2e/review` (the one line added to the regression config in this plan: those specs need their own servers).

### README

Statuses 017, 133 and 137 closed (done in P1/P6 and P2; the rest of 137 is follow-on). Final tally: 126 done, 18 follow-on, 1 deferred.

## Verification

| Check                     | Result                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `check:policy`            | ok — 162 handlers                                                                                                                        |
| `check:validators`        | ok — 117 validators                                                                                                                      |
| `check:tenancy`           | ok — 52 tables                                                                                                                           |
| `check:metrics`           | ok — 16 passed                                                                                                                           |
| Unit                      | 160 / 160                                                                                                                                |
| Chromium e2e (full)       | 146 passed; failures exactly the pre-existing set: `feedback-corrections:244`, `reminders:10`, `treatment-workflow:63` (+ its 3 serial followers); `offers:84` fixed in P11 |
| `test:metrics`            | 17 / 17                                                                                                                                  |
| `test:responsive:gate`    | 434 / 434 at major                                                                                                                       |
| Review captures           | 63 / 63 scenes × devices; REVIEW.md written                                                                                              |
| tsc                       | 102 (baseline 103; delta −1)                                                                                                             |
| Lint                      | New files clean; every touched file delta 0 except `patients.index.tsx` +5 (indentation inherited from the pre-existing mis-indented fragment the hooked span sits in) |

## Follow-on (not in this plan)

Unchanged from the plan: working hours, breaks and leave with diary shading and real `getPractitionerDay` hours; the medical-update review workflow; server-side enforcement of the record role table and the front-desk clinical seed defaults; the missing Settings (hours, cancellation and no-show policy, rooms, templates, VAT, payment provider, retention period, subscription, audit log view); retail sales against a visit with stock; more offer stages; the `listUsers` 200-account limit; the Attention-needed "Due today" chase list (deferred at review).
