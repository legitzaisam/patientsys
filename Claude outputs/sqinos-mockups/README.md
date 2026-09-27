# SQINOS mock-ups

Static HTML mock-ups to build from. Open any file in a browser; no build step.
Fonts load from Google Fonts (Space Grotesk, Instrument Serif), with system fallbacks offline.
All names, numbers and patients are demo data.

## clinic-portal/  (changes to the existing clinic portal)

| File | What it shows | Where it lands in the app |
|---|---|---|
| 01-diary-needs-action-filter.html | One "Needs action" control beside View by (everything / unpaid / deposit / consent / running late). Non-matching cards dim. No chase list on the diary. | Diary page |
| 02-dashboard-attention-needed-chase.html | Attention needed > Urgent gets a "Due today (from the diary)" group: rows by appointment time, one main action matched to the top problem, plus a ⋯ menu (call, open record, mark paid in clinic, snooze). A row clears when sent, or moves on to its next problem. | Dashboard, Attention needed |
| 03-dashboard-full.html | The whole dashboard with that group in place. The toggle at the top switches Owner/Manager vs Front desk (front desk doesn't see £ amounts). | Dashboard |
| 04-action-queue.html | Redesigned task / queue component. | Dashboard, My tasks |

Roles: the Due today group is visible to owner, manager and front desk. Only owner and manager see £ outstanding.

## website-screens/  (the five journey screens from the website, as app screens)

Exported from `launch-plan/website/src/components/JourneyScreen.astro`. Each is drawn from the real portal pieces, but some parts don't exist in the app yet (noted below).

| File | Portal | Not built in the app yet |
|---|---|---|
| 01-book-clinic-diary.html | Clinic · Diary with a Front desk panel (waiting / in treatment / still due, arrived list, due next, to collect today) | Front desk panel, "now" line |
| 02-treat-patient-overview.html | Clinic · Patient record Overview tab (skin journey, From the patient, recall tasks, synced badge) | Overview tab |
| 03-aftercare-patient-plan.html | Patient · Skin Plan & Journey overview (practitioner note, recovery check-in, safe to proceed, snapshot, skincare routine with reminders, AI aftercare assistant) | Routine reminders card layout |
| 04-progress-roadmap-and-pause.html | Patient · Timeline roadmap, next step, Pause my plan (reason, length, request sent to practitioner) | Pause request with reason + length |
| 05-return-offers.html | Clinic offer template + automation → the offer in the patient portal → book with one tap | Offer card in the patient portal |

These screens scale with their frame (CSS container units), so keep the frame around 700–900px wide when previewing.
Design tokens (colours, fonts) are at the top of each file and match the app's `src/styles.css`.

## website/  (the marketing website, self-contained)

| File | What it shows |
|---|---|
| website/home.html | The full home page: loader, serum-drop hero, two doors, six-chapter journey, Clinic OS, before/after, safety, roles, closing call to action |
| website/login.html | The sign-in page (clinic team or patient) |

Everything is inlined (styles, scripts, fonts, screenshots), so these open offline with no build. Demo and sign-in
buttons show a short note here, because the clinic and patient portals only run behind the launch URL.
Preview at desktop width (1200px or more) to see the pinned journey; narrower frames get the stacked phone layout.
Built from `launch-plan/website` (27 Sep 2026).
