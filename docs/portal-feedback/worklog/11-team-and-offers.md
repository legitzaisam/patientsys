# Phase 11: Team and Offers

Branch `e2e_live`, on top of `879e8e9`. 27 Sep 2026.

## Scope

Index bullets 119, 122, 125 (Team), 126, 128, 129, 130, 131, 132 (Offers).

## Changes

### Team (119, 122, 125)

- `listTeam` (production and demo) returns per member `lastActiveAt` (Auth `last_sign_in_at`; demo `staffLastActive`), `commissionRate` (only for the owner or a holder of `reports.commission`, otherwise null), `compliance` (essential documents on file out of ten, registration and insurance expiry) and `accessChanged` (the latest `staff.update` audit row: who and when). Demo `updateStaffMember` now writes that audit row; the seed carries one for Dr Tom Whitfield.
- `staff-doc-compliance.ts` gains `complianceStatus(input, todayKey)`: lapsed registration or insurance → "Registration lapsed" (bad); an expiry inside 60 days → "Insurance expires in 28 days" (warn); missing essential documents → "3 documents missing" (warn); else "Compliant".
- `team.index.tsx`: `MemberMeta` under each card's email line — "Last active today / yesterday / N days ago" (`member-last-active`), the compliance chip (`member-compliance`, `data-tone`), "45% commission" (`member-commission`, never for receptionists) and "Access set by Dr Amara Osei · date" (`member-changed-by`). Cards carry `data-qc="team-member"`.
- `access-control-settings.tsx`: a **Recent changes** log under the grid (`access-changes`): "Dr Amara Osei turned Send documents on for receptionists · 15 Sept 2026, 10:15", newest first, six rows.
- `permissions.ts`: "Team & staff details" describes what `team.view` gates: "Open the Team page and read colleagues' profiles and compliance status. Staff documents, profile edits and access changes stay with managers and the owner."

### Offers (126, 128, 129, 130, 131, 132)

- **Card width (126)**: the one-off grid is one column while a single template exists and two columns from the second (`data-cols`).
- **Subset labels (128)**: `STAGE_META.subset` on every stage card (`offer-stage-subset`): "Signed up, no consultation booked or held", "Consulted, nothing booked, no plan", "One treatment, not booked, no plan", "Plan of three or more sessions, one session or less left". The count is that subset, from the shared definitions (P4).
- **Switch-on preview (129)**: `previewStage` splits the stage into `willSend`, `portalOnly` (due now, no marketing consent, template shows a portal card) and `skipped`. The dialog reads "N patients will get this now, M by portal only" and lists both groups; the automation (production and demo) sends to both with `portalOnlyWhenNoConsent` following the template's portal switch, so the preview is what happens.
- **Results (130)**: `src/lib/offers/results.ts` → `offerResults(offers, appointments, treatments)`: sent, claimed, booked (a non-cancelled appointment created after the claim), revenue (treatments performed after the claim within validity + 90 days). `listOfferTemplates` returns `results` per template; every card shows "N sent → N claimed → N booked → £X revenue" (`offer-results`, numbers hooked as `metric:offers.<stage>.<step>`).
- **Rules (131)**: the editor gains a Rules block (`offer-rules`): expiry (the valid-days field), One per patient, No stacking, Applies to (catalogue checkboxes via `getCatalogue`). `sendOfferToPatients` reads the patients' existing offers once per batch (`store.listOffers`) and skips "Already had this offer (one per patient)" and "Has a live offer already (no stacking)", appends "Applies to: Chemical Peel, Microneedling." to the offer body (`store.catalogueNames`), and `previewStage` applies the same rules (new skip reason `has_live_offer`). Stores: production, automation and demo. The diary's claimed-offer flag only shows on a booking the offer applies to (production and demo `getDashboard`).
- **Delay on the card (132)**: `StageDelay` — a number field on the stage card saved on blur, Enter or the tick (`offer-stage-delay`, `offer-stage-delay-save`) through `setOfferAutomation`, keeping the current on/off state.
- Demo: the seasonal one-off "Autumn skin reset" is seeded with both rules off (staff send it by hand as often as they like); stage templates keep both on.
- `schemas.SaveOfferTemplate.image_url` is `nullableText`: the editor always sends `image_url: null` for a template without a picture, and the schema rejected it ("Image url is required") — the pre-existing `offers.spec.ts:84` failure. Fixed here because the width assertion lives in that flow.

### Tests

- `tests/unit/offers-send.test.ts`: portal-only split; one-per-patient and no-stacking in the preview and in the send (with the "Applies to" line); rules switched off.
- `tests/unit/offers-results.test.ts`: the funnel over a small fixture.
- `e2e/offers.spec.ts`: subset labels, results line, one-column → two-column grid, inline delay, Rules block; the automation test asserts the now / portal-only split and the sent count after the run (the drain delivers 20 at a time, so it presses Process queue twice).
- `e2e/team.spec.ts`: owner sees last active, compliance, commission, "Access set by", and the Recent changes log; front desk sees compliance but no commission.

## Verification

| Check      | Result                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guards     | policy / validators / tenancy ok; `check:metrics` ok (16 + 2 todo)                                                                                                          |
| Unit       | 160 / 160                                                                                                                                                                   |
| tsc        | 102 (baseline 103)                                                                                                                                                          |
| Lint       | New lines formatted: delta 0 in every file except `offer-template-editor.tsx` (+69, all indentation inherited from the pre-existing mis-indented fragment the Rules block sits in, kept consistent with its neighbours); `offers.tsx` −3, `team.index.tsx` −1, `clinic.functions.demo.ts` −6, `offer-automation-dialog.tsx` −2 |
| e2e        | offers, team, comms, rbac, smoke, feedback-corrections: 66 passed + the pre-existing `feedback-corrections:244`; offers `:84` now passes                                    |
| Responsive | offers and team on every device: 66 / 66 (the Rules checkboxes use the 24 px `Checkbox` so the tap probe is clean)                                                          |

## Notes

- Portal-only automation is a behaviour change: before this phase the automation skipped patients without marketing consent; the owner's bullet asks for the portal card instead, and the dialog now says so before the switch goes on. The comment at the top of `automation.server.ts` records it.
- Bullet 125's log shows the latest hand change per role and key (what `role_permissions.updated_by/updated_at` keeps); the full history is in `audit_log`.
