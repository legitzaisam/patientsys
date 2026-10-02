# Phase 6: the tab shell

Branch `e2e_exp`, on top of `96284ce`. 2 Oct 2026. `src/routes/_authenticated/patients.$id.tsx` and one caller. The record now opens on Overview, remembers its tab in the address, and shows the three counts the hand-off asks for. The Overview content in this phase is an interim move (today's visit, the upcoming bookings and the tasks panel lifted out of Treatments unchanged); Phase 7 replaces it with the designed cards.

### pr-p6-01-order

- Tab order: **Overview** (new, `canSee(identity, "patient-overview")`) · Treatments · Before and after · Documents · Medical history · From the patient · Contact. Labels unchanged, so every spec that finds tabs by name still does.
- Default tab is `overview`; a reader without the Overview grant is moved to Treatments once identity loads (`useEffect` on `identity`/`activeTab`).
- Overview `TabsContent` holds, for now, the today's-visit strip (`data-qc="today-visit"`, `open-treatment-form`), the Upcoming appointments card (`bookingsRef`, `booking-chase-item` rows, "Open diary") and `PatientTasksPanel` (`#tasks` / `#recall`). Treatments keeps `TreatmentPlanCard` (`#plan`) and the Treatment history card.

### pr-p6-02-url

- `tabFor(tab, chase)`: `chase=1` → `overview`; the old names `bookings` / `visit-notes` → `treatments`; otherwise the tab or `overview`. Used for the initial state and whenever `?tab=` / `?chase=` change.
- `changeTab()` replaces `setActiveTab` as the `Tabs` handler: it sets state and `navigate({ search: { ...prev, tab, chase: undefined }, replace: true })`, writing `?tab=history` etc. (Overview is the default and is omitted) so Back and a copied link land where the reader was. `showTreatments()` after the treatment form still navigates to `tab: "treatments"`.
- The chase scroll effect now waits for `activeTab === "overview"` and scrolls `bookingsRef` (the Upcoming card). The subtitle "These visits still need chasing…" shows when `chase` is set, as before.
- Hash deep links read the hash through `useLocation({ select: l => l.hash })` so an in-app hash change is a dependency: `#plan` → Treatments, `#recall` / `#tasks` → Overview; the effect switches the tab first, then scrolls once the anchor has rendered (250 ms). Reading `window.location.hash` inside the effect, as before, missed in-app changes because nothing re-ran it.

### pr-p6-03-badges

- `recordTabBadges({ bookingChase, checkins, history })` from Phase 1 drives three `TabBadge`s: Treatments **gold** figure (`data-qc="treatments-badge"`, same `title` "N upcoming bookings still need chasing…" the spec asserts), Medical history and From the patient **pink** circles (`history-badge`, `portal-badge`, with titles). All hidden at 0. The old 15px destructive circle on Treatments is gone in favour of the mockup's gold number.

### pr-p6-04-callers

- `src/components/dashboard/attention-list.tsx` `patientBookingsChaseHref` → `/patients/:id?tab=overview&chase=1` (the Upcoming card lives on Overview now).
- Unchanged and re-checked: `treatment-journeys.tsx` (`tab: "treatments"`, `hash: "plan"` → roadmap), `records-tab.tsx` (`tab: "photos"`), `offer-send-history.tsx` and `notification-bell.tsx` (`tab: "contact"`, `chat`, `treat`).

### pr-p6-05-worklog-06

- Verified on the rebuilt local stack for Grace: opens on Overview with badges Treatments 3 · Medical history 1 · From the patient 1; a real click on Medical history writes `?tab=history` and selects it; `?tab=overview&chase=1` opens Overview with the chase subtitle and the Upcoming card at the top of the viewport; `?tab=photos` selects Before and after; `#plan` lands on Treatments with the plan card at the top; changing the hash to `#recall` from Treatments switches to Overview and scrolls to the tasks card.
- Gates: `tsc` no new errors; per-hunk eslint 0 on the new lines (the four remaining findings sit on the relocated Treatment history markup, unchanged code that Phase 8 replaces); unit suite unchanged.
