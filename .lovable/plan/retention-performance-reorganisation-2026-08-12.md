# Retention & Performance reorganisation

## Current state

**Retention page**
- Four headline stats (rate, one-visit-only, average visits, average gap).
- Rolling 12-month retention trend chart.
- "Where to focus" suggestion panel.
- At-risk patient table with filters and "Mark contacted".
- Cohort table + per-treatment repeat-rate table.

**Performance page**
- Four headline stats (earned, collected, to practitioners, retained by clinic).
- Four trend charts (earnings, appointments, attendance, no-shows) with a practitioner selector.
- A wide 15-column practitioner KPI table with inline commission editing and a "Clinic total" row.

**Strengths**
- The at-risk table is genuinely actionable — a manager can act on it today.
- Commission tracking is a real selling point for multi-practitioner clinics.
- Cohort and treatment-level retention give clinics insight into what keeps patients returning.

**Weaknesses**
- The two pages overlap conceptually (retention appears in both) but live apart, so a manager has to jump back and forth.
- The Performance KPI table is very wide and hard to scan; some columns are more useful in a practitioner detail view.
- Retention has a lot of sections stacked vertically; the most valuable part (at-risk patients) competes for attention.
- Neither page surfaces a "so what?" number front and centre, e.g. estimated revenue at risk or which practitioner has the best repeat-patient rate.

## Selling-point assessment

Yes — this can be a strong selling point, but mainly if it feels **actionable**, not just "reports." Clinic managers buy software that answers:

1. Who do I need to call today to fill my diary? (retention at-risk list)
2. Who is earning me money and who is costing me? (performance table)
3. Am I paying commission correctly? (commission split)
4. Which treatments keep patients coming back? (treatment retention)

The current build covers all four, but the UX can be tightened so the answers are obvious within seconds.

## Proposed reorganisation

Keep two pages, but give each a clearer job:

- **Performance** = financial + practitioner performance (the business view).
- **Retention** = patient loyalty + recall actions (the operations view).

Then make the following targeted improvements.

### 1. Performance page

- Replace the 15-column table with a scannable practitioner summary table (name, earned, collected, attendance, retention, new patients, outstanding, commission). Move the full 15-column detail into an expandable row or a practitioner detail drawer.
- Add per-practitioner sparkline charts in the summary table so managers can spot trends without switching the top chart.
- Keep the four trend charts but default to "Clinic total" and make the practitioner selector more prominent.
- Add a "Top performer this period" highlight tile based on a composite score (earned + attendance + retention).
- Move inline commission editing to a confirmation-style flow so accidental changes are harder.

### 2. Retention page

- Make the at-risk patient table the hero section at the top of the page.
- Add an estimated "revenue at risk" stat tile based on the at-risk patients' average treatment value.
- Add one-click "Send recall message" that opens the message composer with a retention template pre-filled.
- Move cohort and treatment-retention tables behind tabs or an accordion so the page does not feel overloaded.
- Keep the trend chart and "Where to focus" panel as supporting context above the at-risk table.

### 3. Cross-linking

- In Performance, add a link from each practitioner row to a filtered view of their at-risk patients.
- In Retention, show each at-risk patient's lifetime value and last practitioner so the manager knows who to discuss them with.
- On the Dashboard KPI grid, keep the retention tile linking to Retention and add a "Performance" tile linking to Performance.

### 4. Manager-only polish

- Ensure both pages remain manager-only (Practitioners keep their own "Earnings" view).
- Add a short explanatory caption under each headline stat so managers know how it is calculated.

## Outcome

A cleaner manager experience where:
- Performance answers "How is my clinic and each practitioner doing financially?"
- Retention answers "Who do I need to bring back into the clinic?"
- Both pages are quicker to scan and harder to misread.

This should strengthen the sales pitch because it positions the software as a tool that actively protects revenue, not just records it.
