# Retention insights and actions

Retention today is a single number: repeat patients over the last 12 months, shown as one tile on the dashboard, one column on Performance, and one stat on the practitioner Earnings page. It tells you the rate but never who is slipping away or what to do about it.

## What to add

### 1. Dashboard — make the retention tile meaningful
- Keep the tile, but add a trend against the previous 12-month window (up/down vs last period) and a one-line breakdown: returning vs one-visit-only patients.
- Make the tile clickable, opening the new Retention page.

### 2. New "Retention" page (manager view, practitioners see their own)
Sections, top to bottom:

- **Headline band**: retention rate, repeat patients, one-visit-only patients, average visits per patient, average days between visits.
- **Retention trend chart**: rolling retention rate by month over the last 12 months, with a practitioner selector (Clinic total default), matching the existing Performance trends styling.
- **At-risk patients table** — the actionable core. Patients bucketed by lapse risk:
  - `Overdue` — treatment `next_due_at` has passed and nothing booked since.
  - `Lapsing` — last visit 90-180 days ago, no future appointment.
  - `Lost` — last visit over 180 days ago.
  Columns: patient, last treatment, days since, next due, practitioner, risk badge.
- **Actions per row**: message the patient (uses the existing messaging thread and templates), open their record, or mark as contacted so they drop off the list for 30 days.
- **Cohort retention**: patients grouped by the month they first attended, showing what share returned for a 2nd and 3rd treatment. Answers "are new patients sticking?"
- **Treatment-level retention**: repeat rate per treatment from the catalogue, so you can see which treatments bring people back and which don't.

### 3. Suggested actions panel
A short, rules-driven list on the Retention page, e.g.:
- "12 patients overdue for a top-up — send recall messages"
- "Retention dipped 6% this month vs last"
- "Only 41% of new patients returned for a 2nd treatment — consider a follow-up at 2 weeks"
Each links straight to the filtered list so it is one click to act.

### 4. Patient record
Small retention chip on the patient header: visit count, days since last visit, and risk state, so practitioners see it in context.

## Technical notes

- Extend `getDashboard` in `src/lib/clinic.functions.ts` with the previous-period retention figure for the trend arrow.
- New server function `getRetention` (manager sees clinic-wide, practitioner sees own patients) computing: rolling monthly retention, at-risk buckets from `treatments.performed_at` / `next_due_at` and future `appointments`, first-visit cohorts, and per-treatment repeat rates.
- New route `src/routes/_authenticated/retention.tsx` plus components under `src/components/retention/`, reusing the existing card, badge and recharts patterns from `performance-trends.tsx`.
- "Mark as contacted" needs a small table (`retention_outreach`: patient_id, contacted_by, contacted_at, note) with RLS restricted to clinic staff — this is the only schema change.
- Add "Retention" to the sidebar under Performance.
