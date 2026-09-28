// Hand-written notes for the 2026-09-28 e2e_live changelog: what each commit
// changes for the people using the app, in plain language. write-docs.mjs
// combines these with the commit metadata, the file list and the captures.
//
// Every statement here was checked against the diff (`git show <sha>`).

export const SET = {
  id: "2026-09-28-e2e-live",
  title: "e2e_live pull, 28 September 2026",
  branch: "e2e_live",
  from: "e956bfd",
  to: "21dee87",
  base: "d5a5789",
  repo: "https://github.com/legitzaisam/patientsys",
  demoNow: "2026-09-28T09:30:00Z",
  skipped: [
    { sha: "95cc4eb", why: "Only adds static mock-up HTML files under `Claude outputs/` and `public/ipad-qc.html`; nothing in the app changes." },
    { sha: "bc02152", why: "Merge of our pushed `e2e_live` into Zaisam's line; no new content." },
    { sha: "cc21081", why: "Merge; only `zaisam.txt`." },
    { sha: "d5a5789", why: "Merge; only `zaisam.txt`. This is the base state every commit below is compared against." },
  ],
  migrations: [
    { file: "20260930000200_profile_governance.sql", commit: "a9913cc", what: "`profiles.working_arrangement`; `profile_change_requests` gains `registration_expiry`, `work_email`, `working_arrangement`, `requires_owner`." },
    { file: "20260930000300_clinic_setup_roles.sql", commit: "3b3d678", what: "`clinics.has_separate_manager`, `clinics.owner_setup_at`; new tables `clinic_roles` and `clinic_role_permissions` with RLS; `profiles.clinic_role_id`." },
    { file: "20260930000400_manager_approve_changes_opt_in.sql", commit: "d15817d", what: "Turns `team.approve_changes` off for managers where the owner never touched it." },
    { file: "20260930000500_profile_change_inbox_cleared.sql", commit: "20a1e58", what: "`profile_change_requests.inbox_cleared_at`, so a reviewed request can leave the Team inbox without being deleted." },
    { file: "20260930000600_staff_notifications_reply_to.sql", commit: "971c04c", what: "`staff_notifications.reply_to_id` plus an index, so a reply points at the alert it answers." },
  ],
};

/** sha -> notes. `summary` is one line; `changes` are Markdown paragraphs and lists. */
export const NOTES = {
  a9913cc: {
    title: "My profile becomes the home for earnings and performance; phone numbers are validated",
    summary:
      "Earnings and performance move onto My profile as tabs, the separate Earnings page redirects there, staff profiles gain governance fields with an approval flow, and every phone field checks its digit count.",
    observed: `
- A practitioner opening \`/earnings\` lands on **My profile**; the old My earnings page (before) becomes the profile form with **Your performance** and the treatments table underneath (after).
- The tab row (Performance, Security, Documents) and the period picker sit on one line above Your performance. **On an iPad in landscape (1024 px) the heading and subtitle are squeezed to a few characters per line beside that row** — still the case at \`21dee87\`, worth a look.
- The Team member page shows the new fields and a Performance tab; the diary's New booking dialog is unchanged in look (the phone check only shows on blur or submit).
`,
    changes: `
**Who sees it:** practitioners (My profile, Performance tab), owners and managers (team member page, Performance tab on a staff record), front desk (phone checks on New booking).

- **My profile is reorganised.** Registration fields stay on the page; **Security**, **Documents** and a new **Performance** tab sit above the heading. Performance shows the practitioner's earnings share (collected, outstanding, average per treatment), treatments, appointments, new patients, patients seen, attendance, retention, no-shows and cancellations for the chosen period, using the same period picker as the reports.
- **The Earnings page is gone as a destination.** \`/earnings\` now redirects to \`/profile\`; the Earnings entry leaves the sidebar and the dashboard role shortcuts, and the My profile shortcut reads "Your details, earnings and documents". The access catalogue label changes from "My earnings" to "Earnings on My profile", and \`getMyEarnings\` is now allowed for any staff member instead of needing the \`view.earnings\` capability.
- **Profile change requests.** Owners (and software admins) save identity fields directly. Everyone else edits name, job title, registration, work email or working arrangement and presses **Request approval**; a note can be attached. A manager's own request is flagged \`requires_owner\`, so only the clinic owner can approve it. Requests appear in a **Change requests** column on My profile with Awaiting approval / Approved / Declined states. A new **Working arrangement** field (full time, part time, self-employed, contractor, bank/locum) is added.
- **Team member page** (owner or manager opening a staff record) gains Working arrangement, Registration expiry, Insurance provider, Insurance expiry and Qualifications fields, and a **Performance** tab (the same earnings and KPI view, worded "their share") next to Access and Documents.
- **Phone validation** (\`src/lib/phone.ts\`): a shared check that a number has the length its country code expects (UK 11 digits local, 10 after +44; other calling codes by national length). Applied to the diary's New booking (new patient phone), the quick-add appointment form and Clinic details in Settings. Errors show after blur or submit, never while typing.
- **Patient portal, Records:** the record form fields get explicit labels.
- **Smaller:** the access catalogue renames "Pipeline" to "Funnel"; \`clinic-details-settings\` blocks saving with an invalid phone; the demo persona list gains a manager persona field.

**Tests:** new \`e2e/profile-governance.spec.ts\` (tabs on My profile; owner saves identity fields, staff request approval; qualifications save without a request), \`tests/unit/phone.test.ts\`, \`tests/unit/staff-alerts-manager.test.ts\`; rbac and team specs updated for the moved earnings.

**Also in this commit, not part of the app:** \`launch-plan/website/Bento.astro\` and three new diary screenshots for the marketing site; a \`launch-plan/website/.tmp-claude/\` folder with two zips and temp JSON files (looks accidental); \`Claude outputs/return-step-options.html\`, \`sqinos-mockups.zip\`, \`website.zip\`.

**Server-only, not visible:** migration \`20260930000200_profile_governance.sql\`; \`saveMyInstantProfile\` server function; Supabase types.
`,
  },
  "3b3d678": {
    title: "Named clinic roles, an owner set-up question, and a rebuilt Invite staff dialog",
    summary:
      "Clinics can define their own named access packs, the owner is asked once whether the clinic has a separate manager, and inviting staff picks a role from chips.",
    observed: `
- The **Invite** dialog changes from "Invite a team member" with an Access level row (Receptionist, Practitioner, Manager, Clinic owner) to "Invite someone" with a **Role** row (Receptionist, Practitioner, Manager, Clinic owner) and an inline **+ Add a role** action.
- The owner set-up gate does not appear in the demo because the fixture clinic is already set up with a separate manager, so the dashboard capture is unchanged.
`,
    changes: `
**Who sees it:** owners (set-up gate, Staff access grid, invite any level); managers (invite practitioners and receptionists only); everyone else nothing new.

- **Owner set-up gate.** The first time an owner signs in after this change, a full-screen card asks whether the clinic has a separate manager or the owner manages it themselves. The answer sets \`clinics.has_separate_manager\` and stamps \`owner_setup_at\`. Existing clinics are not trapped: the migration marks them set up. In the demo the gate does not show because the fixture clinic is already set up.
- **Named roles (access packs).** Owners can add a role such as "Skin therapist". It starts with **generic floor access** (diary, bookings, contact details, documents) and nothing clinical or financial until the owner turns capabilities on. Reserved names (owner, manager, practitioner, receptionist, admin) are refused. Packs are permission copies stored in \`clinic_roles\` and \`clinic_role_permissions\`; a staff member on a pack has \`profiles.clinic_role_id\` set, and the pack's grants replace the built-in role's.
- **Invite staff dialog** is rebuilt around role chips: Clinic owner, Manager (only when the clinic has a separate manager), Practitioner, Receptionist, plus any named roles, with an inline **Add a role** field. Only the owner may invite owner or manager access; a manager may invite the rest.
- **Staff access grid** gains a column per named role; the Manager column only appears when the clinic has a separate manager. The Team page shows an **Enable manager access** button when it does not, and role selects hide Manager accordingly. Member cards show the named role next to the person.

**Tests:** \`e2e/clinic-setup.spec.ts\` (asks whether the clinic has a separate manager; owner adds a named role that starts generic; a manager can invite but cannot see owner, manager or the access grid), \`tests/unit/clinic-roles.test.ts\`, \`tests/unit/generic-staff-defaults.test.ts\`.

**Server-only:** migration \`20260930000300_clinic_setup_roles.sql\`; server functions to complete set-up, create a role and set a named role's permission; \`assertStaffInvite\` enforces the invite rules on the server as well.
`,
  },
  d15817d: {
    title: "Profile change approvals can be handed to managers; Staff access gets groups and a change log",
    summary:
      "Approving staff profile changes stays with the owner unless the owner grants it, approvers are notified accordingly, and the Staff access panel is reorganised into collapsible groups with a Recent changes popover.",
    observed: `
- The Staff access panel gains its shield heading and the capability rows are grouped; the last row of the grid, **Approve profile change requests**, is now off for Manager.
`,
    changes: `
**Who sees it:** owners (grant the capability, see the change log); managers (see the approval queue only once granted).

- **Approve profile change requests** is now a capability the owner switches on per access level. It is **off for managers by default**; the migration turns it off wherever a manager grant was never edited by the owner, and leaves owner-made grants alone. The catalogue text explains what it covers (name, job title, registration, work email, working arrangement).
- **Who gets notified:** \`profileChangeApproverIds\` always includes owners and software admins, adds anyone whose role or named pack has the capability, never the requester, and keeps a manager's own request with the owner even if that manager can approve others.
- **Staff access panel:** the capability list is split into collapsible groups (all open at first), headed by **Staff access** with a shield icon and a one-line explanation that differs for owners and read-only viewers. A **Recent changes** popover lists who turned which capability on or off for which level, newest first.
- **Team page:** the approval queue appears for a manager once the grant is on (tested end to end).
- **docs/CODEBASE_MAP.md** is added: how roles, capabilities, server authorisation and clinic isolation fit together.

**Tests:** \`e2e/clinic-setup.spec.ts\` ("the grant starts off; turning it on shows the queue to the manager"), \`tests/unit/profile-change-policy.test.ts\` (owner always notified, requester never; manager only when granted; manager self-changes stay with the owner).

**Server-only:** migration \`20260930000400_manager_approve_changes_opt_in.sql\`.
`,
  },
  "20a1e58": {
    title: "Staff access grid: icons, counts, pinned header and animated groups; reviewed requests can be cleared",
    summary:
      "The access grid gets role icons, per-group granted counts, a header that pins while scrolling and animated collapsible groups; reviewed profile change cards show who reviewed them and can be cleared from the Team inbox.",
    observed: `
- Column headers carry role icons and "n of 17 on"; each group header shows a granted count (5/5, 2/5); **Collapse all** and **Recent changes** sit on the panel header.
`,
    changes: `
**Who sees it:** owners (grid editing), managers with the approval grant (inbox), the requester (their own history is untouched).

- **Grid header:** each access level has an icon and a "n of 17 on" count; every group row shows a granted count such as 5/5 or 2/5. The header **pins under the page toolbar** while the grid scrolls (watched with an IntersectionObserver against the main scroll container), with a shadow line when pinned.
- **Groups animate** open and closed on the height Radix measures (\`.collapsible-panel\` keyframes), and a **Collapse all / Expand all** button toggles them.
- **Reviewed requests in the Team inbox** show "Approved by" or "Declined by" with the reviewer's name, and a **Clear from inbox** cross removes the card for the clinic without deleting the request from the staff member's own history (\`inbox_cleared_at\`). Clearing needs the approval capability.
- Layout is more responsive: column widths come from the number of levels (\`minmax(13rem,1fr) repeat(n, 6rem)\`).

**Tests:** \`e2e/clinic-setup.spec.ts\` extended; \`tests/unit/profile-change-policy.test.ts\` covers when the approval queue is visible (off when only the owner can approve; on when a manager is granted; still off for a manager's own request).

**Server-only:** migration \`20260930000500_profile_change_inbox_cleared.sql\`; \`dismissProfileChangeRequest\` server function.
`,
  },
  "142563a": {
    title: "Access history dialog; the staff bell shows new bookings only",
    summary:
      "Recent access changes move into an Access history dialog, the staff notification bell stops carrying patient messages (they live in the chat bubble), and several tests are aligned with the front desk claim flow.",
    observed: `
- The bell popover before lists patient messages (Leila Farouk, Zara Haddad, Sienna Clarke, Olivia Bennett) under "Bookings and patient messages"; after it reads **New bookings** and shows only the booking alert.
`,
    changes: `
**Who sees it:** owners (Access history); all staff (bell contents).

- **Access history** replaces the popover: a dialog listing the latest change to each capability, newest first, opened from the Staff access header. The header sticky rule is hardened so a later \`position: relative\` cannot undo it.
- **Notification bell, staff:** now "new bookings only". Patient messages no longer appear in the bell for staff and no longer raise a staff toast; they are read in the chat bubble. Patients still get a toast for a new message from their clinic. The subtitle "Bookings and patient messages" goes.
- **Tests:** a patient's message must reach the clinician in the chat box and not the bell; front desk sees the claim on the record and the diary card; treatment workflow and offers specs adjusted; profile approval tests scroll the main container.
`,
  },
  "46dff1a": {
    title: "Team chat in the floating dock",
    summary:
      "The chat window gains a Team tab for 1:1 staff conversations next to the Patients tab, opening alerts jump to the right teammate, and the toolbar inbox keeps team alerts separate from chat.",
    observed: `
- Before, the chat bubble opened straight into patient conversations with no Team tab (recorded as missing). After, the window opens on **Team** with the colleagues listed and unread counts on both tabs.
- The alerts pill is unchanged.
`,
    changes: `
**Who sees it:** all staff.

- **Two tabs in the chat window:** **Team** (1:1 staff chat, opens first) and **Patients** (portal threads). The bubble shows the combined unread count; each tab shows its own. Team conversations list each colleague with their last message ("You: …") or job title; the header reads "Team messages and alerts".
- **Opening a team alert** (from the toolbar inbox or a toast) jumps to that teammate's conversation in the Team tab.
- **Toolbar inbox** (bell) lists team alerts, not team chat messages.
- **Server:** new \`listStaffThreads\` (staff only) returns a thread per colleague with unread counts; demo data layer implements the same.
- \`sent-staff-alerts\` and \`staff-chat-panel\` are refactored to render inside the window; the dock context tracks the open tab and thread.

**Tests:** \`e2e/team-chat-dock.spec.ts\` (toolbar inbox lists alerts not chat; window opens on Team and Patients holds the patient threads; opening an alert jumps to the teammate).
`,
  },
  d625c36: {
    title: "Practitioner card from the sidebar: availability, urgent notes, message; alerts can be acknowledged or dismissed",
    summary:
      "Sidebar team avatars open a card with today's free slots, the practitioner's recent urgent alerts and a Send message button; the team chat panel lets recipients acknowledge or dismiss alerts.",
    observed: `
- Before, the sidebar avatars were not pressable (recorded as missing). After, pressing Dr Nadia Rahman opens her card with **Today's availability**, the free slots and **Send message**.
- On the iPad the sidebar sits in a drawer; the card opens over it.
`,
    changes: `
**Who sees it:** all staff (sidebar card); alert recipients (acknowledge, dismiss).

- **Sidebar team list:** each avatar is now a press target that opens a **practitioner card** showing today's availability (free slots, "No free slots left today" when none), the practitioner's latest urgent alerts (\`practitioner-day-alerts.ts\`: team-wide alerts stored once per recipient are folded into one entry, the viewer's own copy preferred; dismissed ones drop out; three at most) and a **Send message** button. Online colleagues get a green ring.
- **Team chat panel:** an alert the viewer received can be **acknowledged** ("Alert acknowledged") or **dismissed** (needs \`notifications.delete\`); the panel has a stored font size.
- **Team member page** loses its side-by-side messages column and resizable chat; messaging happens in the dock.
- Bell and dock context simplified to hand thread requests to the chat window.
`,
  },
  "765c1cc": {
    title: "Online colleagues first; day-card alerts open in the chat, ready to act on",
    summary:
      "The sidebar sorts online teammates first, an alert on a teammate's day card opens the Team chat focused on that alert, and the alert peek no longer covers the chat window.",
    observed: `
- The sidebar Team list drops the signed-in owner and lists online colleagues first.
`,
    changes: `
**Who sees it:** all staff.

- **Sidebar order:** online colleagues first, then alphabetical; the viewer is left out of the list.
- **Day card alerts:** the urgent alerts on a practitioner's card are buttons; pressing one closes the card and opens the Team chat on that teammate with the alert in focus, its acknowledge and **Dismiss alert** buttons visible and the reply box focused.
- **Alert bubble:** a passive peek of the alert panel is suppressed while the chat window is open, so it never covers the conversation; opening the pill on purpose still works.

**Tests:** "an urgent alert on a teammate's day card opens where it lives, ready to act on".
`,
  },
  a4c6f6d: {
    title: "Diary and chat clean-up: My appointments, a lighter quick-reply toast, simpler persona switching",
    summary:
      "The diary's View by pill says My appointments for the signed-in practitioner and drops the needs-action hint line, the chat quick-reply toast becomes a small dockable notice, and the demo persona switcher reloads to a page the new persona can open.",
    observed: `
- The one-line hint under the Day planner header ("n appointments today need something…") is gone; otherwise the diary is unchanged.
`,
    changes: `
**Who sees it:** practitioners (diary label), all staff (toast), demo users (persona switcher).

- **Diary:** when the only selected practitioner is the signed-in user, the View by pill and column header read **My appointments** instead of the name. The one-line **needs-action hint** under the planner header ("n appointments today need something…") is removed along with its helper.
- **Quick-reply toast:** the 353-line toast with an inline reply textarea (fetching and sending chat from inside the toast) is replaced by a compact notice with a title, description and **open** action; it can be dragged to dock off the left edge with a 15% peek.
- **Practitioner card:** the message dialog state is removed; **Send message** goes straight to the dock chat.
- **Demo persona switcher:** switching now does a full reload to a page the new persona can open (patient goes to \`/my-record\`; leaving the portal or the Access page lands on \`/dashboard\`), instead of clearing the query cache in place.
- A few styles for the old toast are deleted.
`,
  },
  "971c04c": {
    title: "Reply to a team alert; one source of copy for the plan's next step",
    summary:
      "Team alerts can be answered in place (text only) and the reply lands with the sender; the journey board and the plan card share the same wording for a plan's next step, booking and lateness.",
    observed: `
- Journey board and plan card wording changes only where a step is late or booked; the dashboard layout is unchanged.
`,
    changes: `
**Who sees it:** all staff (alerts, chat); owners, managers and practitioners (journey board, patient record plan card).

- **Reply to an alert.** In the Team chat, an alert has a reply action; the composer shows a "Replying to …" chip, attachments are refused for replies ("Replies to alerts are text only"), and the reply is stored with \`reply_to_id\` so both sides can quote it. Titles are parsed as "Message / Urgent / Reply from Name: topic"; the toast and the sender's Team alerts show "Reply from Name". Sent alerts list replies.
- **Plan step copy** (\`plan-step-copy.ts\`) is shared by the journey board and the Treatments tab plan card: "Booked 28 Sep" when a visit is in the diary, "Due 28 Sep" / "Due today" / "Due tomorrow" otherwise, "3d overdue" once late; an overdue step keeps its due copy next to the booking so lateness stays visible; the chip reads Overdue or the risk reason.
- **Today snapshot** (dashboard) allows horizontal panning on touch.
- **Sonner** gains pin and unpin helpers so an alert toast can stay put.

**Tests:** \`e2e/patients.spec.ts\` checks the date and step wording on board cards.

**Server-only:** migration \`20260930000600_staff_notifications_reply_to.sql\`; \`replyToStaffAlert\` server function and schema.
`,
  },
  "8a89a91": {
    title: "Overdue steps say how late they are",
    summary:
      "A late plan step shows \"n days overdue\" beside its title on the journey board and the plan card, the date line keeps only the booking, and replying to an alert is tested end to end.",
    observed: `
- Late steps on the board read "Title, n days overdue" next to the Overdue chip.
`,
    changes: `
**Who sees it:** owners, managers and practitioners (journey board, patient record Treatments tab).

- **overdueLabel:** "7 days overdue" (at least "1 day overdue") for a slipped step; the step line becomes "**Title**, 7 days overdue" and the date line shows only the booking when there is one. The Overdue chip is unchanged, so the word appears on the chip and on the step line, not three times. \`nextStepLine\` no longer prefixes "Overdue:" or "Next:".
- **Team chat panel** wording adjusted for reply rows.

**Tests:** board cards now expect the two-place overdue wording; \`e2e/team-chat-dock.spec.ts\` gains "replying to an alert sends it to the sender's Team alerts with a toast" (the chip names the alert, attachments are hidden, the sent list shows Reply).
`,
  },
  "789f666": {
    title: "Treatment due means the board's Book chase, for every role",
    summary:
      "Attention needed's Treatment due rows are exactly the patients whose plan has no live booking, scoped to the practitioner's own patients or the whole clinic, each row opening the record's Treatments tab; replies to urgent alerts and message toasts are wired through.",
    observed: `
- Attention needed's This week group shows **Treatment due** for the owner and front desk; the practitioner dashboard shows only that practitioner's due patients.
`,
    changes: `
**Who sees it:** owners and front desk (clinic-wide chase), practitioners (their own plan patients), patients (message toasts).

- **Treatment due = Book chase.** The dashboard's Treatment due rows are built from active plans with no upcoming booking, the same set that shows a **Book** button on the journey board, so the two never disagree. A practitioner sees only their own unbooked plan patients; front desk and owners see the clinic-wide list. Opening a row lands on the patient record with the Treatments tab selected. Rows carry \`data-qc="attention-treatment-due"\`.
- **Notification bell:** because the demo has no realtime, the bell polls and raises message toasts on both sides (staff and patient) when a thread's unread count grows; team alert kinds refresh the staff threads and the open chat.
- **Urgent alert card:** replying from the card uses \`replyToStaffAlert\`, so the reply reaches the sender's toast, Team alerts and thread.
- **Team conversation list** previews an alert as "Urgent alert: …", "Alert: …" or "Reply: …".
- **Data layer:** \`clinic.functions.ts\` and the demo layer are reformatted (line wrapping) alongside the functional changes, which is why the diff is large; the substantive change is the treatment-due query and scoping.

**Tests:** \`e2e/patients.spec.ts\` "attention treatment due" for owner, practitioner and front desk (every Treatment due name has a Book button on the board; Nadia only sees her unbooked plan patients; Sofia sees the clinic-wide chase); \`e2e/patient-portal/sync.spec.ts\` message toasts; \`e2e/team-chat-dock.spec.ts\` reply from the urgent card.
`,
  },
  "9202460": {
    title: "Is that booking for this step? No-shows, booking from the plan card, profile requests in Attention needed",
    summary:
      "A shared rule decides whether a diary booking belongs to a plan's next step, the plan card shows a No show tag or names a booking for something else and can book the step itself, and pending profile change requests join Attention needed for owners and managers.",
    observed: `
- Attention needed → This week gains **Skin-plan treatment due** and **Profile change request**, and the **Message** group is gone; Urgent is unchanged.
`,
    changes: `
**Who sees it:** owners, managers and practitioners (plan card, journey board, dashboard); owners and managers (profile change requests in Attention needed).

- **plan-step-state.ts** (decisions dated 28 Sep 2026): a booking counts as the step's when the Book button linked it (\`plan_milestones.appointment_id\`) or, for a session step, when its treatment matches the plan's. A step with its own live booking is not overdue, however late the due date. A booking for something else leaves the step overdue and is **named on the plan card** so nobody thinks the chase is done. Not turning up is a **No show** (90-day look-back) until that booking is rescheduled or cancelled.
- **Plan card (Treatments tab)** can **book the next step** directly; the appointment is linked to the milestone. It shows the booking note, the No show tag and a Book next step button when nothing is booked.
- **Attention needed:** the kind label becomes **Skin-plan treatment due**; a new **Profile change request** kind lists pending staff requests for the owner, admin or manager (never the viewer's own; owner-only requests hidden from managers); the old Message kind is dropped from the list.
- **Deposit rules:** Deposit due is Urgent inside the lead window, This week up to 10 clinic days out, otherwise omitted; a patient already on Urgent is not repeated under This week (\`appointment-flags.ts\`).
- **docs/audits/**: an independent recalculation of the Insights numbers from the raw seed (\`insights-recalc.ts\`, \`insights-shown.ts\`, an audit test and a baseline JSON). Three root scripts \`check-diary.mjs\`, \`check-flow.mjs\`, \`check-step.mjs\` are added here and removed again in \`21dee87\`.

**Tests:** e2e (Book button per Skin-plan treatment due name; a booking for another treatment is named on the card and the chase stays; a missed step is tagged No show and keeps its place; Sofia sees clinic-wide dues in the window; urgent deposit not repeated; owner and manager see pending requests, a practitioner does not); unit tests for plan step copy, profile change attention and metrics definitions.
`,
  },
  "58d3dbe": {
    title: "Reporting periods in London time, one set of counting rules, and the Insights audit written up",
    summary:
      "Adds the period and rules modules that define what a window, a visit, a booking and money mean everywhere, records the Insights numbers audit, and aligns the deposit horizon with the new urgency rule.",
    observed: `
- Settings → Payments and deposits: the deposit rule copy ends "under This week until 10 days out". Dashboard and Insights numbers are unchanged in the demo at this commit (the recalculation lands in 21dee87).
`,
    changes: `
**Who sees it:** owners (Settings copy, dashboard deposit lists); mostly groundwork that \`21dee87\` wires into the pages.

- **metrics/period.ts:** reporting windows in Europe/London. "12 months" and "6 months" are whole calendar months ending with the current month, "1 month" is the current calendar month, "7 days" the seven days ending today, custom ranges run midnight to end of day, and the previous period is the same span immediately before. Nothing after now is counted or charted.
- **metrics/rules.ts:** one place for status and exclusion rules: on the list (not deleted), booked (not cancelled, including no-shows and future), attended (status attended and started), live future booking, consultation.
- **Deposit horizon:** the Attention deposit query looks ahead by the lead days plus 10 clinic days rather than a flat 30, and uses the urgency helper; the Settings copy reads "under This week until 10 days out".
- **docs/audits/insights-numbers.md** records the audit: definitions agreed before the fix (visit, no-show, earned, collected, outstanding, dormant, default window, rounding) and the before/after tables; \`render-table.mjs\` prints them.

**Tests:** \`tests/unit/metrics-definitions.test.ts\` extended.
`,
  },
  "21dee87": {
    title: "Metrics refactor: one module per question, period picker rebuilt, scratch scripts removed",
    summary:
      "Insights, Retention, Performance, earnings and the dashboard KPIs now read from shared metrics modules (book, visits, funnel, money, retention, dashboard), the period picker is rebuilt on the London-time period model, and the three check-*.mjs scripts are deleted.",
    observed: `
- **Insights → Patient base:** the third tile becomes **New patients** for the whole selected window, 312 (was New this month, 26); Rebooked 56% → 51%; Spend per patient £710.89 → £708.64 and Visit value £256.42 → £256.04 as visits replace treatment rows; New vs returning 361 / 270 → 357 / 280; the Website source count 100 → 98. Dormant reads "Treated before, no visit in 12 months".
- **Performance (owner):** Earned £452,840 → £451,405, Collected £447,517 → £446,082, To practitioners £193,682 → £193,079, Retained by clinic £259,158 → £258,326 — the integer-pence money model with refunds taken off Earned and Collected.
- **Retention** is unchanged (65%, 123 one-visit-only, 3.4 average visits, £111,510 at risk). The period pill labels are unchanged.
`,
    changes: `
**Who sees it:** owners and managers (Insights, Retention, Performance, dashboard KPIs), practitioners (My profile Performance), anyone using a period picker.

- **Shared metric modules:** \`book.ts\` (Total, Active, Inactive, New patients as of the window end), \`visits.ts\` (a visit is one attended appointment; several treatments in one appointment are one visit; a treatment with no booking is its own visit), \`funnel.ts\` (enquiries → booked → consulted → treated, one person counted once), \`money.ts\` (integer pence; Earned, Collected, Outstanding, Booked ahead; practitioner share per line), \`retention.ts\` (rolling 12-month repeat rate shared by Retention and the dashboard KPI), \`dashboard.ts\` (KPI figures shared by live and demo). \`insights.server.ts\` shrinks from about 800 lines to reading these; \`earnings.server.ts\`, \`retention.server.ts\` and the demo layer follow.
- **Period picker** is rebuilt on \`metrics/period.ts\`; its own date helpers go. Every metrics page reads the same window definition.
- **Insights tiles:** New this month becomes **New patients** for the selected window; Dormant reads "Treated before, no visit in 12 months"; source-mix percentages come from the server (largest remainder, adding to 100); funnel tiles get \`metric:\` test ids.
- **Removed:** \`check-diary.mjs\`, \`check-flow.mjs\`, \`check-step.mjs\` from the repo root (added in \`9202460\`). Added: \`scripts/ipad-viewports.mjs\`, which opens the app in WebKit at iPad sizes for a manual check.

**Tests:** \`tests/metrics/consistency.test.ts\`, \`tests/unit/metrics-definitions.test.ts\` and \`e2e/metrics/rendered.spec.ts\` updated to the new modules and ids.
`,
  },
};
