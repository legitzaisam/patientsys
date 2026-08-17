# Practitioner earnings & performance

Yes to both. Managers get a per-practitioner performance view with earnings, KPIs, retention and the clinic/practitioner split. Practitioners get their own earnings page showing their share and their own KPIs only — never the clinic's cut or the split percentage.

## Commission model

- Each staff member has one commission rate, set by the manager (e.g. practitioner 40% / clinic 60%). Default 0% until set.
- Rate changes apply going forward; the rate in force is stored on each treatment record so history doesn't shift retrospectively.

## Earnings figures

Two figures shown side by side everywhere:
- **Earned** — value of treatments recorded as performed in the period.
- **Collected** — value of the linked bookings marked as paid.

Practitioner share = figure x their rate. Clinic share = the rest (managers only).

## Manager view — new "Performance" page

A table of all practitioners, plus an expandable card per person:
- Earned and collected for the selected period (this month / last month / this year).
- Their share, the clinic's share, and their commission % (editable inline by the manager).
- Treatments performed, patients seen, new patients.
- Their own retention rate (patients they treated who returned in the last 12 months).
- Average value per treatment.
- Clinic totals row at the top: total earned, total collected, total to practitioners, total retained by clinic.

## Practitioner view — new "My earnings" page

Visible to every staff member, showing only their own figures:
- Total earnings (their share) — earned and collected, for the selected period.
- Treatments performed, patients seen, new patients, their retention rate, average value per treatment.
- A list of their treatments with date, patient, treatment and their share.
- No clinic revenue, no clinic share, no commission percentage anywhere on this page.

## Technical notes

- Migration: add `commission_rate numeric` (0-100, default 0) to `profiles`; only managers can set it. Add `commission_rate_snapshot` to `treatments`, stamped when a treatment is recorded.
- Because practitioners must not see the split, all money maths happens server-side: server functions return only the fields the caller's role may see, and the rate column is never sent to a non-manager.
- New server functions in `src/lib/clinic.functions.ts`:
  - `getPractitionerPerformance({ from, to })` — manager only (`requireOwner`), returns per-practitioner earned/collected, shares, KPIs and retention plus clinic totals.
  - `getMyEarnings({ from, to })` — caller's own share and KPIs only.
  - `setCommissionRate({ userId, rate })` — manager only.
- New routes: `src/routes/_authenticated/performance.tsx` (manager) and `src/routes/_authenticated/earnings.tsx` (all staff), each with its own `head()` metadata and `robots: noindex`.
- `src/components/app-shell.tsx`: add "Performance" for managers, "My earnings" for staff.
- Collected figures come from `appointments.payment_status = 'paid'` attributed to the practitioner; earned comes from `treatments.performed_at` + `price`.