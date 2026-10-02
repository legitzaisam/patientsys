# Phase 4: Grace Adeyemi's demo data

Branch `e2e_exp`, on top of `053fe4f`. 2 Oct 2026. `src/lib/demo/data.ts` only. Grace is `patients[9]` (AV-1263, Dr Nadia Rahman's patient). Every date is relative to the demo clock, so the record reads the same on any day. Olivia's portal fixtures and every other patient are untouched; the generated id sequence before Grace's block is unchanged, so no other fixture id moved.

### pr-p4-01-plan

- `GRACE_STEPS` (new) replaces the shared `MICRONEEDLING_STEPS` in her recipe: Consultation & consent · Skin assessment & photos · Microneedling session 1 | Microneedling with PRP · One-week review · **Microneedling session 2** | Three-week review · Maintenance review — eight steps the generator splits 3 / 3 / 2 across the months, five done, step 6 `current` with `nextDueIn: 3` and no booking (so it reads *Not booked*).
- `PlanStepSpec.dueIn` (new, optional): an upcoming step's own due date in days from today. The generator used the recipe's `nextDueIn` for every upcoming step, which put Grace's reviews on the same day as the session; hers are now due in 23 and 74 days. Other recipes are unaffected (no `dueIn` → previous behaviour).
- The current step's checklist is rewritten in Grace's block: "Pause retinoids 2 days before" ticked by the patient two days ago (`done_by_kind: patient`), "Arrive with clean skin" open, "Session confirmed by clinic" `clinic_owned` and open.
- The plan's treatment is still "Microneedling" (`PLAN_TREATMENTS`), and both of Grace's future bookings are for Microneedling with PRP, so neither links to a step: the Upcoming card reads "2 booked · 0 on plan" with *Not on skin plan* on each.

### pr-p4-02-appointments

- Today's visit (`TODAY_PLAN`, `patientIndex: 9`): 60 minutes instead of 75 and `payment: "unpaid"` instead of `deposit_paid`, so the hero shows "Balance £295 · Not paid"; stage `aftercare` and signed consent unchanged, so **Continue treatment form** resumes the form.
- A second future booking (+22 days, Sunday-safe, 11:30, unpaid, no consent document) beside the generated one (+19 days, deposit paid): the two chip sets the mockup shows, *Balance due · Consent due* and *Deposit unpaid · Consent due*.

### pr-p4-03-history-photos

- The plan generator's filler had already given session 1 a plain "Microneedling" visit; its product and dose are stripped, area "Full face", £220, note "Good response to the second sitting…", so the history filter *Forms missing* catches it (`Depth not recorded`). The four PRP rows stay as generated.
- Every past treatment gets a signed consent document (`treatment_id` + `consent_document_id`), the latest also an aftercare document (`sent`), and a complete `treatment_sessions` row (creating the attended appointment behind it where the generator had none) so **✓ Treatment record** / **View record** works on each row.
- Her previous generic photo set is replaced by six `before` photos taken at the latest treatment ("Before photos on file · 6 photos").

### pr-p4-04-portal

- Recovery check-ins: two days ago 76 / 48 / 20 with "Cheeks still red and warm in the evening. Is that normal on day 4?" (unreviewed → *Urgent*), four days ago 45 / 22 / 18 reviewed by Nadia, five days ago 14 / 12 / 10 (*No flag*).
- Journal: "Day 4" two days ago with two photo attachments, "Day 1" five days ago, both `shared_with_clinic`.
- Her pending medical version (already seeded, `source: patient`, unreviewed) now carries the mockup's content: allergies "Lidocaine, itchy rash (2019)", medications "Tretinoin 0.025% cream, nightly", created three days ago. The patient row still reads "None known / None" until **Accept into record** merges it.

### pr-p4-05-tasks

- `addManualTask` recall "3-month review after Microneedling with PRP", context "Auto-created from <date>", front-desk pool, due 90 days after the treatment, `auto_close: false` — a manual contact task otherwise auto-closes as soon as any later booking exists, and the sessions she has booked are not the review. The chase-booking task for session 2 and the plan-support task keep coming from the rules at runtime.

### pr-p4-06-worklog-04

- Verified on the rebuilt local stack (`/patients/d10000-0000-4000-8000-000000000290`): today's visit 10:15 unpaid, 3 bookings to chase (today's unpaid visit is still ahead at the time of the check), 5 of 8 steps, next step due in 3 days, five history rows each with a record, three open tasks (chase, plan support, recall). Gates: `tsc` no new errors, per-hunk eslint 0 (the block is prettier-formatted in isolation), unit 272 passed with the 11 known failures.
