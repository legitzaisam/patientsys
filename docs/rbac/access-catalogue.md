# Role access catalogue

Baseline of what the four demo pill roles can see, captured from the demo clinic before the live access editor was wired. Screenshots are full pages. A direct URL that bounced is noted under the role.

Personas: Dr Amara Osei (clinic owner), Dr Nadia Rahman (practitioner), Sofia Marchetti (receptionist), Olivia Bennett (patient).

The live editor is at `/access`. Only the software-developer admin can open it. The clinic owner edits staff access on Team. It is not a grant, and it is not in the tables below.

## How to read the tables

- **Yes** means the page, tab, or component is on screen for that role.
- **URL only** means the address loads, but the item is not in the navigation.
- **No** means the address leaves the page (usually back to the dashboard or the patient home).
- **Fixed** means the rule is not a switch: owner-only, or a data scope such as a practitioner's own book.

## Clinic owner

Sidebar: Dashboard, Diary, Patients, Insights, Retention, Performance, and the team list. Earnings is not in the sidebar. Team, Offers, and Settings are in the account menu. The alert toolbar, notification bell, and staff dock are visible.

| Surface | Visible | Rule | Screenshot |
| --- | --- | --- | --- |
| Dashboard, including diary, attention, follow-ups, pause requests, journeys, revenue, retention | Yes | Owner holds every grant | [owner-dashboard](screenshots/owner-dashboard.png) |
| Diary, including booking | Yes | Staff page | [owner-schedule](screenshots/owner-schedule.png) |
| Patients, records and journey board | Yes | Staff page | [owner-patients](screenshots/owner-patients.png) |
| Patient record: Treatments, Before and after, Documents, History updates, From the patient, Contact | Yes | Staff page. Archive and restore are owner-only | [owner-patient-record](screenshots/owner-patient-record.png) |
| Team, current and former staff, invite, revoke, access grid | Yes | Owner | [owner-team](screenshots/owner-team.png) |
| My profile | Yes | Staff page | [owner-profile](screenshots/owner-profile.png) |
| Settings, including edits and ingest keys | Yes | Owner | [owner-settings](screenshots/owner-settings.png) |
| Insights, pipeline and book | Yes | Owner | [owner-insights](screenshots/owner-insights.png) |
| Retention | Yes | Owner | [owner-retention](screenshots/owner-retention.png) |
| Performance | Yes | Owner | [owner-performance](screenshots/owner-performance.png) |
| My earnings | URL only | Any staff member can open the address. It is hidden from the owner sidebar because the owner is a manager | [owner-earnings](screenshots/owner-earnings.png) |
| Offers | Yes | Owner | [owner-offers](screenshots/owner-offers.png) |

## Practitioner

Sidebar: Dashboard, Diary, Patients, Retention, Earnings, and the team list. Insights and Performance are absent. Settings is not in the account menu, but the address still opens a read-only settings page. The dock and alert toolbar are visible. The diary and retention figures are limited to this practitioner's own book. That scope is fixed, not a switch.

| Surface | Visible | Rule | Screenshot |
| --- | --- | --- | --- |
| Dashboard, titled My day. Retention KPI is on. Revenue KPI is off | Yes | `reports.retention` on, `reports.performance` off | [practitioner-dashboard](screenshots/practitioner-dashboard.png) |
| Diary | Yes | Staff page | [practitioner-schedule](screenshots/practitioner-schedule.png) |
| Patients | Yes | Staff page | [practitioner-patients](screenshots/practitioner-patients.png) |
| Patient record, all six tabs. Record treatment, photos, and send document are available. Archive is not | Yes | Clinical grants on. Archive is owner-only | [practitioner-patient-record](screenshots/practitioner-patient-record.png) |
| Team. Cannot invite, revoke, or edit the access grid | Yes | `team.view` on, `team.approve_changes` off | [practitioner-team](screenshots/practitioner-team.png) |
| My profile | Yes | Staff page | [practitioner-profile](screenshots/practitioner-profile.png) |
| Settings | URL only | Page loads. `settings.treatments` is off, so edits are refused | [practitioner-settings](screenshots/practitioner-settings.png) |
| Insights | No | Redirects to the dashboard. `reports.insights` is off | [practitioner-insights](screenshots/practitioner-insights.png) |
| Retention | Yes | `reports.retention` on, own book only | [practitioner-retention](screenshots/practitioner-retention.png) |
| Performance | No | Redirects to the dashboard. The page and the server both require a manager, and `reports.performance` is off | [practitioner-performance](screenshots/practitioner-performance.png) |
| My earnings | Yes | Sidebar link for a practitioner who is not a manager. The address is open to any staff member | [practitioner-earnings](screenshots/practitioner-earnings.png) |
| Offers | No | Redirects to the dashboard. `offers.manage` is off | [practitioner-offers](screenshots/practitioner-offers.png) |

## Receptionist

Sidebar: Dashboard, Diary, Patients, Insights, Retention, and the team list. Performance and Earnings are not in the sidebar. Settings is in the account menu because `settings.treatments` is on in the demo. The dock is visible. Clearing notifications is off.

| Surface | Visible | Rule | Screenshot |
| --- | --- | --- | --- |
| Dashboard, titled Front desk. Retention KPI is on. Revenue KPI is off | Yes | `reports.retention` on, `reports.performance` off | [front_desk-dashboard](screenshots/front_desk-dashboard.png) |
| Diary | Yes | Staff page | [front_desk-schedule](screenshots/front_desk-schedule.png) |
| Patients | Yes | Staff page | [front_desk-patients](screenshots/front_desk-patients.png) |
| Patient record, all six tabs. Record treatment and photo upload are refused. Send document is available. Archive is not | Yes | `treatments.record` and `photos.manage` off. Several of those buttons still render and fail on save | [front_desk-patient-record](screenshots/front_desk-patient-record.png) |
| Team. Cannot invite or revoke | Yes | `team.view` on | [front_desk-team](screenshots/front_desk-team.png) |
| My profile | Yes | Staff page | [front_desk-profile](screenshots/front_desk-profile.png) |
| Settings, including treatment edits | Yes | `settings.treatments` on in the demo | [front_desk-settings](screenshots/front_desk-settings.png) |
| Insights | Yes | `reports.insights` on | [front_desk-insights](screenshots/front_desk-insights.png) |
| Retention, clinic-wide | Yes | `reports.retention` on. There is no client redirect if this grant is later turned off; the API refuses the data | [front_desk-retention](screenshots/front_desk-retention.png) |
| Performance | No | Redirects to the dashboard | [front_desk-performance](screenshots/front_desk-performance.png) |
| My earnings | URL only | Not in the sidebar, but the address loads | [front_desk-earnings](screenshots/front_desk-earnings.png) |
| Offers | No | Redirects to the dashboard | [front_desk-offers](screenshots/front_desk-offers.png) |

## Patient

Sidebar: Home, Skin Plan & Journey (Overview, Timeline, Journal, Skincare Routine), My Clinic, My Profile / Records, Appointments, Resources. Billing and Settings are in the account menu. The portal chat dock is visible. Staff pages are not.

| Surface | Visible | Rule | Screenshot |
| --- | --- | --- | --- |
| Home | Yes | Own record | [patient-home](screenshots/patient-home.png) |
| Skin plan overview | Yes | Own record | [patient-plan](screenshots/patient-plan.png) |
| Timeline | Yes | Own record | [patient-plan-timeline](screenshots/patient-plan-timeline.png) |
| Journal | Yes | Own record | [patient-plan-journal](screenshots/patient-plan-journal.png) |
| Skincare routine | Yes | Own record | [patient-plan-routine](screenshots/patient-plan-routine.png) |
| My clinic | Yes | Own record | [patient-clinic](screenshots/patient-clinic.png) |
| My profile / records | Yes | Own record | [patient-records](screenshots/patient-records.png) |
| Appointments | Yes | Own record | [patient-appointments](screenshots/patient-appointments.png) |
| Resources | Yes | Own record | [patient-resources](screenshots/patient-resources.png) |
| Billing | Yes | Account menu | [patient-billing](screenshots/patient-billing.png) |
| Settings | Yes | Account menu | [patient-settings](screenshots/patient-settings.png) |
| Dashboard | No | Redirects to Home | [patient-denied-dashboard](screenshots/patient-denied-dashboard.png) |

## Mismatches in this baseline

These are the places the navigation, the page, and the API do not agree. The access editor uses one grant for each surface so a later toggle moves all three together.

- Earnings is a sidebar link only for a practitioner who is not a manager. The address still opens for the owner and the receptionist.
- Settings is missing from the practitioner account menu, but `/settings` still renders.
- Performance requires a manager in the page and again on the server, as well as `reports.performance`.
- Retention has no client redirect. Without `reports.retention` the shell can appear and the API then fails.
- On a patient record, record-treatment and photo upload can still be on screen for the receptionist. The server refuses the save.
- A practitioner's dashboard and retention report show only their own book. Front desk and owner see the clinic.
