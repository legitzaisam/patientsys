# Phase 9: From the patient and Medical history

Branch `e2e_exp`, on top of `54b92f8`. 2 Oct 2026. Four new components under `src/components/patients/record/` and one helper in `src/lib/patients/record-overview.ts`; the `portal` and `history` tabs in `src/routes/_authenticated/patients.$id.tsx` are rebuilt from `Claude outputs/export/mockup-screenshots/05-…` and `06-…`. The data was already there from Phase 3 (`reviewed_at` on check-ins, `pendingHistory`, journal attachments) and Phase 4 (Grace's three check-ins, two journal entries and the pending portal update).

### pr-p9-01-urgent

- `urgent-checkins-card.tsx`: `UrgentCheckinsCard({ checkins, treatments, phone, patientId, canReview })` (`data-qc="urgent-checkins"`, `data-open`). Renders only when the patient has ever had a flagged check-in (`checkinNeedsAttention`); while any is unreviewed the card carries the mockup's pink border and glow and an "n open" badge, otherwise a neutral border, "All reviewed" and one line pointing at the table.
- Each open item (`data-qc="urgent-checkin"`, `data-date`) on a pink wash: `SeverityBars` (Redness / Sensitivity / Dryness with Severe · Moderate · Mild words), "29 Sep, 19:12 · day 2 after Microneedling with PRP" (`shortDate` + `clockTime(created_at)` + `dayAfterTreatment`), the patient's note in quotes (or "No note left with this check-in."), then **Call patient** (`checkin-call`, a `tel:` link on the record's phone, the same target as Contact) and **Mark reviewed** (`checkin-review`, `treatments.record`) → `reviewRecoveryCheckin({ patient_id, checkin_date })`, toast, patient refetch: the item leaves the card, the row in the table reads Reviewed and the From the patient badge drops.

### pr-p9-02-all-checkins

- `all-checkins-table.tsx`: `AllCheckinsTable({ checkins })` (`data-qc="checkins-table"`): "All check-ins" / "Self-reported between visits."; header row Date · Redness · Sensitivity · Dryness · (status) on the mockup's `70px repeat(3, 1fr) 80px` grid; rows newest first (`checkin-row`, `data-date`, `data-status`) with `SeverityWord` per reading and **Open** (pink) / **Reviewed** (green) / "No flag" from `checkinStatus`. Empty state "No check-ins submitted yet."

### pr-p9-03-journal

- `journal-list.tsx`: `JournalList({ journal, treatments })` (`data-qc="journal-list"`): "Journal" / "Only entries the patient chose to share with the clinic."; entries newest first (`journal-entry`), each a white row with a 64px thumbnail of the first photo (a "+n" corner when there are more), "Day 4 · 29 Sep" from `journalDayLabel`, and the body. Empty state "No journal entries shared yet."
- Tab layout: the urgent card full width, then `grid-cols-1 lg:grid-cols-2 items-start` with the table and the journal.

### pr-p9-04-history-updates

- `pendingHistoryFields(version, patient)` in `record-overview.ts`: the three clinical fields `acceptHistoryUpdate` merges (allergies → "New allergy", medications → "New medication", conditions → "New condition"), only where the submitted text differs from what is on file; diet, pregnancy and the rest stay in the version list for reading. Unit-tested (19 pass).
- `patient-updates-card.tsx`: `PatientUpdatesCard({ history, patient, patientId, canAccept, onBackToOverview })` (`data-qc="patient-updates"`) at the top of Medical history, only while something is pending: "Updates from the patient" / "Added in the portal on 29 Sep. Nothing changes in the record until a clinician accepts it."; one lilac row per pending version (`patient-update`, `data-id`, `data-accepted`) with its labelled fields (`patient-update-field`, `data-key`) and **Accept into record** (`patient-update-accept`, `treatments.record`) → `acceptHistoryUpdate`, toast, patient refetch. The accepted row stays in view reading **✓ Accepted** (`patient-update-accepted`) until the reader leaves the record, with its fields compared against nothing so they do not vanish once the header matches. A version with nothing mergeable shows its summary and "Nothing here changes the allergies, medication or conditions on file." **← Back to Overview** (`patient-updates-back`) → `changeTab("overview")`.
- The existing version list stays beneath, unchanged (its Mark reviewed still dismisses a version without merging).

### pr-p9-05-worklog-09

- Captures in `captures/09-portal-history/` (`owner--ipad-mini--portal.png`, `owner--ipad-pro-landscape--portal.png`, `owner--ipad-mini--history.png`, `owner--ipad-pro-landscape--history.png`, WebKit; `owner--laptop-1440--portal.png`, `owner--laptop-1440--history.png`, Chromium). Against `05-…`: pink-bordered urgent card with "1 open", bars with Severe / Moderate / Mild, timestamp and day-after line, the quote, Call patient and Mark reviewed stacked right; All check-ins and Journal side by side beneath with Open / Reviewed / No flag and the Day 4 · 29 Sep thumbnail entry. Against `06-…`: Updates from the patient with New allergy / New medication and Accept into record, ← Back to Overview, the version list below. No horizontal overflow on either iPad.
- Exercised on the rebuilt local stack (8199) for Grace as owner: Call patient is `tel:07723517807`; Mark reviewed → toast, `data-open` 0, "All reviewed", table 29 Sep reads Reviewed, From the patient badge gone; on a fresh stack, Accept into record → header Allergies "Lidocaine, itchy rash (2019)" and Medication "Tretinoin 0.025% cream, nightly", row "✓ Accepted" with both fields still shown, Medical history badge gone, Accept button gone; ← Back to Overview lands on Overview with the `tab` search cleared.
- Gates: `tsc` no new errors against the baseline; per-hunk eslint 0 on the route, the four new components, the helper and the test; `tests/unit/record-overview.test.ts` 19 passed.
- Note for Phase 10: `e2e/patient-portal/sync.spec.ts` looks for a heading "Recovery check-ins" on this tab; the cards are now "Urgent recovery check-ins" (only while something is flagged) and "All check-ins", so that assertion moves to "All check-ins".
