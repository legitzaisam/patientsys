# Aetheria clinic portal: owner view to-do

Sep 26, 2026 · @Zai

## Before 2 October

These are the fixes a clinic owner would notice in a live demo. Everything else in this doc can follow after the pitch.

- [ ] Show loading placeholders instead of "0" and "£0" on the dashboard, and a message if data fails to load.
- [ ] Make the money figures on Performance add up: Earned £397,075, Collected £58,280 and Outstanding £118,600 leave about £220,000 unexplained.
- [ ] Fix the Insights Composition count, which misses patients who had the same treatment twice (4 + 123 + 305 = 432 of 641).
- [ ] Settle one definition each for "due", "overdue", "to chase", "one visit only" and "first-to-second", so every page shows the same number for the same idea.
- [ ] Remove developer notes from screens: "Demo keeps this on this device only", "Nothing is emailed or texted from here yet", "No cart", "Process queue", "sandbox", the Integrations web address and key.
- [ ] Correct the Team page subtitle, which tells the owner "you hold manager access".
- [ ] Use one name for the front desk role everywhere ("Receptionist" or "Front desk").
- [ ] Remove or source the made-up benchmarks on Insights ("clinic median \~46%", "\~69%", "clinics often 25–40%", "aim near 30/70").
- [ ] Grey out the marketing sub-toggles when Marketing is off on a patient's Contact tab.

## Across the whole portal

The biggest theme is consistency: the same idea is counted, named or formatted differently from page to page.

**Design**

- Add yellow outline to the icons on header
- Scrollable sidebar Team list (or link to the Team page); with more staff it pushes Dashboard off screen.
- Create pop-up cards for diary view for iPad use

**Wording**

- Drop pence on large figures (£27,100, not £27,100.00). Keep pence on individual payments.
- Every percentage chip says what it compares against, for example "+27 pts vs last year".
- Label every time window the same way: calendar year vs rolling 12 months, and highlight the active filter.
- Remove seconds from timestamps. "Last seen 0 days ago" becomes "Last seen today".
- Decide on one name format ("Grace Adeyemi" vs "Adeyemi, Miss Grace") and use it on purpose.

**Improvements**

- Give each follow-up list one clear job: dashboard for today and this week, Insights for new patients who haven't converted, Retention for existing patients drifting away.
- Put a confirmation step on every Archive, Remove and role change.
- Warn before leaving a page with unsaved changes.

## Dashboard

The dashboard looks premium; the work is making its numbers agree and its lists actionable.

**Design**

- Suggested order for owners: numbers, a short Attention summary, today's diary, journeys, then tasks.
- Week view could show appointments per day, £ booked and how full each practitioner is, above the cards (only for clinic owner and manager view).
- Journey columns cut text off ("Maintena…"); use two lines or fewer details. Clicking on the patient's card in the journey columns, takes us to the journey tab in the patient's record page.
- In My tasks, add a due date and owner to each task.

**Wording**

- What does due and overdue mean on dashboard? How does it filter on the patient record page.
- Remove the  "10" next to the 'Diary' in sidebar.
- "#3 · Fat Dissolving" reads better as "Session 3 · Fat Dissolving".
- The deposit rule ("at least 3 days before") is written into the page. Read it from Settings instead.

**Improvements and fixes**

- Managers get a hidden error: the dashboard asks for incomplete-profile alerts, but only the owner is allowed to load them (`listAccountsMissingEmail` in `policy.ts`).
- Add a "Due today" chase list at the top of Attention needed → Urgent (see the mockup): patients ordered by appointment time, one main action per row, rows clear themselves, £ shown to owner and manager only.
- Make every number link through to its list.
- The missing-email check only reads the first 200 accounts across all clinics; fix before a second clinic signs up. (This is just demo)

## Diary

The diary is strong; the main gap is real working hours, which also fixes the hover card's free slots.

**Design**

- Add a "Colour key" under the timetable.
- Add a "Needs action" button beside "View by" (see the mockup). Clicking it highlights outstanding appointments and fades the rest; a dropdown narrows it to Unpaid, Deposit due, Consent due or Running late. No chase list on the diary itself.
- Add a "now" line across day view at the current time.

**Improvements and fixes**

- Working hours, breaks and leave:
  - Clinic opening hours go in Settings (owner and manager).
  - Each staff member's regular pattern goes on their Team profile. Owner or manager edits it; staff request changes through the existing approval flow.
  - Leave and one-off absences are time-off entries on the Team profile, requested by staff and approved by a manager, plus "Mark unavailable" on the diary for same-day sickness.
  - The diary shades out-of-hours time and leave, and warns or blocks bookings into it.
- The hover card assumes everyone works 9:00–18:00 (`getPractitionerDay` in `clinic.functions.ts`). Read real hours once they exist.
- Separate bug: the same function uses the server's clock, not UK time. On a UTC server, free slots are an hour out during British Summer Time. Use the `clinic-time` helper.
- Practitioners should open on their own diary by default, with "All practitioners" available. Today everyone starts on All.
- Mark Quick book appointments "details incomplete" so front desk finishes them.

## Patients list and journey board

The journey board is one of the best things in the product; make it agree with the dashboard and let people act from it.

**Design**

- Add a "Book" button on any board card showing "No upcoming booking" or overdue, opening Quick book pre-filled.
- Use the same late-bar colour rule as the dashboard (pink when late), and sort each column with at-risk patients first.
- Add a hint on the page that clicking the checkboxes will allow to send offers, can write something like: "Select patients to send an offer".
- Refine the filters so that we'll have  all active, inactive treatments due, and an extra filter called "no upcoming treatment". It filters by no upcoming treatments, and that way we can bulk select them and send them an offer.&#32;

**Wording**

- Label board dates "Due 28 Sep" (not booked) or "Booked 28 Sep" (in the diary).
- The journey stages have two sets of names and descriptions ("Results & confidence" vs "Results & review"). They're defined twice in code (`journey-board.tsx` and `treatment-journeys.tsx`); use one shared definition.
- Make "DD/MM/YYYY" read "Date of birth".
- "Select all" should say what it covers, for example "Select all 137 matching".

**Improvements and fixes**

- Task column:  clicking on the one open pill should take us into the patient's record, where the actual task will show up under recall tasks for the user to chase up. If there is an outstanding task that needs to be completed or an overdue appointment that needs to be booked, then it all goes under here. The manager and the clinic owner can assign it to a specific staff member to chase.
- Next treatment: add the date.&#32;
- Add pagination: the list currently loads all 641 patients at once.  the pagination should have both the capability to move from the current page to the next page and from the current page to the previous one, and also the double arrow to move from beginning of the page to the end of the list.
- Offers from the list: warn before sending, for example "12 of 40 haven't opted into marketing, so they'll see it in their portal only". Let a sent offer close any open recall task for that patient.
- Roles: owner sees lifetime spend in the patient records' overview. Practitioners default to "My patients"; front desk sees a medical alert flag without details (what does that mean?)&#32;

## Patient record

The most important fix here is safety: a patient's medical update is saved but nobody is told.

**Design**

- On the patient page, where we have the patient card, keep the record treatment, but move the other ones, like send form, send offer, and archive, into a "⋯" menu. When clicking on Archive, it's asks for confirmation and starts the 8-year retention clock.
- Remove chat panel, and have the chat bubble show consistently across all pages. However, to open the selected patients' chat when on the patient record, we'll add a 'Open Chat' button next to 'Record treatment' in the patient card, with a notification badge in case there are any unread messages.&#32;

**Wording**

- Rename the "History updates" tab to "Medical history" in three places: `patients.$id.tsx` (\~line 667), `access-catalogue.ts` (\~line 157) and `permissions.ts` (\~line 139). Keep the internal key `view.patients.history`.
- Contact tab: remove "Nothing is emailed or texted from here yet" and hide "Process queue", "sandbox" and "1 attempt" from non-admins. "Sent by text · 14 Sep" is enough.
- 'Offers' card should go above contact preferences.&#32;

**Improvements and fixes**

- Medical updates awaiting review. Today `submitHistoryUpdate` (`clinic.functions.ts`, \~line 4129) only saves the update:
  - Show "1 medical update awaiting review" on the record header.
  - Notify the patient's active practitioner; if none, the front desk, owner or manager.&#32;
  - Add it to the practitioner's Attention needed → Urgent, escalating to owner or manager after about 48 hours.
  - Warn before starting a treatment form: "Review medical update before treating".
  - Show what changed ("None → Iron supplement") with "Apply to record" and "Mark reviewed", logging who and when.
- Check the counts: Treatments tab badge vs visits; the list's "1 open" task vs "No recall tasks yet"; dashboard consent status vs Documents.
- the Recall Tasks card under the Treatments tab in the patient's record specifically says "No recall tasks yet." Assign one from the Retentions page by hovering over a patient's practitioner. We can remove "Assign one from the Retentions page by hovering over a patient's practitioner". we need to synchronise the recall tasks from the retention page to the recall tasks card that's going to be showing in the overview tab in the patient's record. Whatever recall tasks are created on the retention page need to also show up in the patient's record.

**Who sees what (suggested starting point)**

| Section | Owner | Manager | Practitioner | Front desk |
| --- | --- | --- | --- | --- |
| Header: contact, date of birth | Yes | Yes | Yes | Yes |
| Allergies, medication, conditions | Yes | Yes | Yes | Yes |
| Treatments and notes | Yes | Yes | Yes | Yes |
| Before and after photos | Yes | Yes | Yes | Yes |
| Documents | Yes | Yes | Yes | Signed or due, not contents |
| Medical history and from the patient | Yes | Yes | Yes | No |
| Contact and preferences | Yes | Yes | Yes | Yes |
| Archive | Yes | Yes | No | No |

## Insights

Insights has one real counting bug and several definitions that need tightening.

**Design**

- In Book: Replace the Active vs inactive donut (it repeats the card above) with patients by last visit: under 3 months, 3–6, 6–12, 12+.
- In Pipeline: Use the same format in both "Needs a next step" lists (days waiting), and add "Schedule" to the Consulted list.&#32;
- &#32;in pipeline, for both the Needs the Next Step card and where we have the Waiting for a First Booking and the Other Consulted No Treatment Yet cards, make sure that we have pagination where, for every page, we have around 10 records. We have both single-page pagination and first-and-last-page pagination added to the cards&#32;
- Raise chart contrast; beige, grey and pale pink are hard to tell apart on a projector. Use pastel colours to match the brand colours.

**Wording**

- In the Insights page, in the pipe-line tab, "Sign-ups" card says website leads, but the source mix includes Instagram and Referral. Rename ("Online enquiries") or define it.
- Rename the "Book" tab ("Patient base"); "not a recall list" is unclear, so remove.
- Shorten the "Needs a next step" description to one line.
- Say "ranked by revenue" on What sold.

**Improvements and fixes**

- Composition bug (`insights.server.ts`, \~lines 597–598): "Treated once" means one visit, but "Two or more" means two or more different treatments, so repeat visits of the same treatment are dropped. Count 0, 1 and 2+ visits (can be the same treatment type) as a rule.
- The same person appears in both next-step lists (Mr Dominic Eastham). if a patient has been consulted but hasn't booked a treatment yet, then their name should not be showing in the "Waiting for a first booking" card.
- "1 year" shows Nov–Dec, which haven't happened. Show rolling 12 months; and give the Book tab a date range.
- Add retail's share of total revenue. Total revenue made from selling retail products should be on the earnings page, and then we'll move what sold from the insights page to the earnings page.
- Consider moving first-to-second and rebooked to Retention: Insights for growth and marketing, Retention for keeping patients, Performance for staff and revenue.&#32;

## Retention

Retention's figures conflict with Insights and the dashboard for the same ideas; one set of definitions fixes most of it.

**Design**

- The at-risk table is too wide: Send recall and Mark contacted fall off a laptop screen. Pin the patient column.
- &#32;drop the practitioner column, and then, when pressing the send recall button, have a feature inside the pop-up box that allows the clinic owner or the manager to assign the recall task to one of the team members (rather than having to do it themselves). That way, we don't lose the hover-over feature when hovering over the practitioner's name.
- Cohort table: the current month shows 0%; show "Too early" instead. Add % to the chart's y-axis.

**Wording**

- Remove '27%' from retention card.
- Under 'Where to focus", it says "The engine sharpens as more data accrues" → "These get more accurate as your clinic's data grows."
- Add one line under Revenue at risk explaining how it's worked out.
- Use the same action words here and on the dashboard tasks.

**Improvements and fixes**

- Conflicting numbers for the same idea:
  - "Only 24% of new patients return for a second" here vs 59% first-to-second on Insights vs 47–91% in the cohort table.
  - "One visit only 112" here vs "Treated once 123" on Insights.
  - "51 overdue" here vs "137 to chase" and "153 overdue" on the dashboard.
- All numbers on the retention page should match based on the selected date filter.&#32;
- Logic check: Mr Finn Thornhurst's next due (14/11/2025) is before his last visit (13/04/2026). Next due should come from the latest treatment.

## Performance

The headline money figures need to reconcile before an owner will trust this page.

**Design**

- One time filter per page; today there's one at the top (1 year) and another on Trends (1 month). remove the time filter for the trends graph. When the user clicks the filters on the top of the page, if they click on 1 week, then show the earnings of that week in the trends graph. If they press 1 month, then show the 1-month earnings in the trends graph, and so on and so forth.&#32;
- The earnings chart says "earned and collected" but shows one line. Add the second line.&#32;
- In the expanded practitioner row, the trend line runs past the card's right edge. Fix it.
- Move "How to read this" into an info icon beside the headings.

**Wording**

- "Dr Rahman's extras" → "Details".

**Improvements and fixes**

- Earned £397,075, Collected £58,280 and Outstanding £118,600 don't add up (about £220,000 unexplained). Define them so they reconcile.
- Dr Rahman shows 665 treatments but 296 appointments. For the KPIs or the practitioner KPIs, show the total number of treatments completed within the date range or the filter.
- Make commission and "to them" figures owner-only; a manager sees counts, attendance and retention. this could be editable in the team and access page, so we can add that under the staff access card. It can be toggled on and off by the clinic owner, and the clinic owner gets to decide whether a manager is able to see the commission made by the practitioner. The logic behind this is that a clinic owner could also be the manager. It could be one person, and that is subject to the settings and the team members added. One person can both be the clinic owner and the manager. However, for bigger clinics, there may be a clinic owner, and they may be a manager. They are two separate people, and in that case, the clinic owner is then able to edit what the manager can and can't see.

## My earnings and My profile

Both pages mix the practitioner's share with the full treatment value, and they repeat each other.

**My earnings**

- Earned (£33,082) is the practitioner's share, but Outstanding (£27,660) and Average value (£252.15) are full treatment value. Show everything as their share (average would be about £101) or label each card.
- "Earned" means treatment value on Performance and share here. Rename this one "Your share".
- Hide the page for owners who don't treat patients.
- Add the commission rate, payout status (paid or pending) and a CSV/PDF export for their accountant.
- Card icons are all the same calendar icon; use distinct icons or none.
- The floating Alerts pill covers the Year total; check the nested scroll on iPad.

**My profile**

- "Your performance" repeats My earnings. Keep a short summary with a "See my earnings" link, or remove it.
- The period filter shows nothing selected though figures are for a month; highlight the active option.
- Registration body: make it a dropdown (GMC, NMC, GPhC, GDC, HCPC, None) and add registration expiry, insurance provider and expiry, and qualifications, with renewal reminders to the owner.
- Work email is greyed out with no reason; add "Ask the clinic owner to change this".
- Add the working hours, breaks and leave section here (see Diary).
- Security wording: remove "Demo keeps this on this device only"; "so a stolen session is not enough" → "We'll email you a code first to confirm it's you"; "CURRENT" → "This device".
- Make Security and Documents proper tabs above the heading.

## Team and access

The access grid is a strong selling point; tidy the wording and review the default permissions before showing it.

**Design**

- To avoid accidental deletion of a team member, keep the bin icon behind a confirmation pop-up.&#32;
- Each team member should have could show last active, compliance status (registration and insurance expiry) and commission rate.&#32;

**Wording**

- Subtitle says "you hold manager access" to the owner. Show "You're the clinic owner".
- "Receptionist" here, "front desk" elsewhere.  rename everything that mentions "front desk" to "receptionist."
- Rewrite "Team & staff details"; its description ("Everyone can view…") contradicts the toggle.  change the description to match the toggle, please.

**Improvements and fixes**

- Review the defaults: Receptionist has Insights and Treatments & colours (which includes clinic details) on, while Practitioner has Insights off; Manager has "Design and automate offers" off.
- &#32;add an edit patient records capability in the staff access under clinical record, and allow the manager and practitioner to be able to do this, but not the receptionist
- Log who changed which permission and when.

## Offers

Offers is a pitch highlight; showing the revenue each offer brings in would make it the strongest page.

**Design**

- A single one-off template card at half width looks unfinished; widen it When there isn't a second one-off template card beside it, and if there is a second template card that we create, then it can just shrink back to its size.
- Put a confirmation step on Archive, which sits beside Edit.

**Improvements and fixes**

- Stage counts disagree with other pages: Post-consultation 20 here vs 5 on Insights; Single treatment 90 here vs 112 on Retention and 123 on Insights. Make all numbers consistent, which is the task that you're going to do across the entire platform.
- Switching a stage on (Single treatment: 11 would receive today) should confirm with a preview: "11 patients will get this now, 3 by portal only".  essentially, once we switch on the single treatment toggle, whoever has their email marketing on can receive the offer, and whoever doesn't have their email marketing on will receive it to their portal only.  this needs to be updated in the pop-up box after clicking the toggle to 'on'.
- Show results per offer: sent → claimed → booked → £ revenue.
- Add offer rules: expiry date, which treatments it applies to, one per patient, no stacking.
- Pre-consultation sends a 1–2 day default. Add an editable feature to be able to send whenever the clinic sets the wait time to.&#32;

## Settings

Settings works, but parts read like developer screens and several settings clinics expect are missing.

**Design**

- Split the long page into sections or tabs: Clinic, Hours, Treatments, Products, Payments and deposits, Messages, Forms, Data and privacy, Subscription. Apply pagination to the treatments offered card. You can show 10 treatments and then allow it to have an arrow to move to the next page and an arrow to move back, add double arrow to move to first page and to the last page.&#32;
- Hide the reset icon when a colour is already the default.
- Put archived treatments behind "Show archived".
- Retail products: show "Archive" as text, matching treatments.

**Improvements and fixes**

- Missing settings: opening hours; deposit rules; cancellation and no-show policy and fees; rooms and equipment; consent and aftercare templates; logo on forms; VAT; payment provider; data retention period; subscription and billing (owner only); audit log.
- Add a way to record a retail sale against a visit, plus stock levels, low-stock alerts and cost price with margin (owner only).

## Roles and security, for the engineer

Hiding a tab doesn't stop the data loading: the server has to block what each role can't see before real clinics use Aetheria.

- Tab visibility keys (`view.patients.photos`, `view.patients.treatments` and so on) only hide the interface. `getTreatmentRecord`, `getTreatmentSession` and `getAppointmentNote` are open to any staff in `policy.ts`, front desk included. Enforce the patient-record role table on the server.
- Front desk defaults were seeded with `treatments.record` and `photos.manage` on (migration `20260824000000_rbac_capability_keys.sql`); the migration's own note recommends switching them off for new clinics.
- `listAccountsMissingEmail` is owner-only, but the dashboard calls it for managers. Allow managers or stop calling it.
- Practitioners' dashboard week view receives the whole clinic's week and filters it in the browser; day view filters on the server. Make both work the same way.
- `listAccountsMissingEmail` calls `auth.admin.listUsers` with a 200 limit across all clinics; page through or filter by clinic.
- `getPractitionerDay` uses server time instead of UK time; use `clinic-time`.
- If the manager is a different person to the clinic owner, then the manager cannot see how much the clinic has actually made in total. They can only see the retention page, but nothing to do with the earnings of the actual clinic. That should only be viewed by the clinic owner. However, if there is one person that is the clinic owner and manager, then they are able to see everything.&#32;

## Future roadmap

These are worth raising in the pitch as "coming next", not building before 2 October.

- **NHS Summary Care Record.** First email the National Care Records Service team (england.liveservices.operations@nhs.net) to ask whether private aesthetic clinics are eligible. If yes, clinics use the NHS website and Aetheria records "Summary Care Record checked" with date and practitioner. Later: a direct connection (needs the NHS network connection, NHS logins and NHS approval) or a partner that's already approved. Pitch it as "NHS record access on the roadmap", not "NHS integration".
- **In the meantime:** GP details and consent to contact the GP, a patient upload of their NHS App summary at intake, and a "Letter to GP" template.
- **Rooms and equipment booking,** so a laser or room can't be double-booked.
- **Waitlist and cancellation backfill.**
- **No-show protection** tied to deposit rules.
- **Course booking:** book all sessions of a plan at the right intervals in one go.
- **Offer results and more offer stages** (win-back, overdue, birthday).

Mockups made in this review: the diary "Needs action" filter, the Attention needed chase list, and the full dashboard with the chase list.
