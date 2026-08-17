# Improve the clinic overview dashboard

## Goal
Make the clinic overview calmer, more scannable, and immediately actionable. The dashboard should surface what needs attention today while respecting role: managers see clinic-wide KPIs, practitioners and front desk see their own day and patients.

## What we will build

1. **Today snapshot (top section)**
   - A compact horizontal panel showing today's appointments with patient name, treatment, time, stage (arrived / waiting / in treatment / aftercare / complete), consent status and payment status.
   - One-click actions from each card: mark stage, send consent reminder, send payment link/balance request, view receipt.
   - Empty state when no appointments are booked today.

2. **Attention needed (middle section)**
   - A unified "needs action" list grouped by urgency:
     - **Urgent today**: unsigned consents for today's appointments, unpaid today's appointments, no-show follow-ups.
     - **This week**: treatments due / recall opportunities, messages awaiting reply.
   - Each item links directly to the patient record or diary.

3. **Calmer KPI tiles**
   - Reduce the four existing tiles to a cleaner row: larger numbers, softer labels, subtle trend arrows (up/down vs last period) where data exists.
   - Remove the dense grid-within-grid border; use spaced cards with consistent radius.

4. **Role-based view**
   - **Manager/owner**: full KPIs + today snapshot + attention list + a small "team today" strip (who is in, who is treating whom).
   - **Practitioner**: their own today's diary + their patients due + their unread messages.
   - **Front desk**: today's arrivals/check-ins + unpaid appointments + consent reminders.
   - Detailed practitioner performance stays on the existing Team / Performance page.

5. **Responsive layout**
   - Single column on small screens, two-column on desktop with today snapshot spanning full width and attention list + KPIs side-by-side.

## Technical approach

- Extend `getDashboard` in `src/lib/clinic.functions.ts` to return:
  - `todayAppointments`: appointments for the current date enriched with patient, practitioner, document status.
  - `attentionItems`: derived urgent items from documents, appointments, messages and due treatments.
  - `trends`: optional previous-period comparisons for revenue and patient count.
- Add a small `TrendBadge` component for up/down indicators.
- Create a `TodaySnapshot` component and an `AttentionList` component in `src/components/dashboard/`.
- Update `src/routes/_authenticated/dashboard.tsx` to render the new layout and pass role flags from `useIdentity()`.
- Keep existing charting libraries out unless the user later asks for graphs; use numbers, badges and lists for the calmer aesthetic.

## Out of scope
- Full practitioner performance charts (remain in Team / Performance).
- Complex revenue/patient trend charts (can be added later if requested).

## Success criteria
- A manager can open the dashboard and immediately see what is happening today and what needs action.
- A practitioner can see only their relevant day and follow-ups.
- The page feels less cluttered and the most important numbers stand out.