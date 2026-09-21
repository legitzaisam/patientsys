---
name: V4 patient portal wireframes
overview: Recreate the eight Vivara mockups as a navigable V4 wireframe app at docs/patient-portal/v4 — identical layout and content to the mockups, but rendered in the clinic portal's exact Aetheria theme (butter accent, ink, glass, Space Grotesk) — backed by a mock data service, and verified with side-by-side screenshot comparisons against the originals.
todos:
  - id: p0-scaffold
    content: "Phase 0: Scaffold docs/patient-portal/v4 from v3 tooling (Vite+React+router, renamed aetheria-portals-v4), prune v3 decks, launcher page"
    status: completed
  - id: p0-theme
    content: "Phase 0: aetheria.css theme ported from clinic src/styles.css (palette, glass, shadows, notebook wash, Space Grotesk) + copy avatar/skin/product assets"
    status: completed
  - id: a-mock
    content: "Phase A: mock seed + api (plan, milestones w/ step details, journal, routines+adherence, check-in, clinic, news/offers, messages, treatments, records)"
    status: completed
  - id: b-shell
    content: "Phase B: app shell (sidebar w/ badges + support section, top bar) and shared UI (stat tile, tab pills, progress ring, milestone track, sliders, table)"
    status: completed
  - id: c1-home
    content: "Phase C: Home page (stat tiles, news, offers, next appointment, plan progress, latest message, quick actions, banner)"
    status: completed
  - id: c2-overview
    content: "Phase C: Plan Overview (KPI strip, Today/Next action, Recovery check-in, Before/After, Journey snapshot, Safe to Proceed)"
    status: completed
  - id: c3-timeline
    content: "Phase C: Timeline (month roadmap, status chips, Step Details panel, Pause Plan modal with validation)"
    status: completed
  - id: c4-journal
    content: "Phase C: Journal (filter chips, entries w/ photos/tags/voice note, calendar, share card, new entry)"
    status: completed
  - id: c5-routine
    content: "Phase C: Skincare Routine combined (Routine 2 layout + Routine 1 practitioner-photo banner; adherence ring, reminder, skin response, product guide)"
    status: completed
  - id: c6-clinic
    content: "Phase C: My Clinic (clinician, clinic details + map placeholder, upcoming/completed, other-clinics history table)"
    status: completed
  - id: c7-records
    content: "Phase C: My Profile / Records (personal, emergency, medical, treatment timeline, labs, documents, before/after banner)"
    status: completed
  - id: c8-stubs
    content: "Phase C: Stub pages (Appointments, Billing, Settings, Resources, Messages) so all navigation works"
    status: completed
  - id: d-compare
    content: "Phase D: Playwright screenshots of every page, side-by-side comparison sheets vs mockups in v4/comparisons/, iterate to layout parity, typecheck"
    status: completed
  - id: d-commit
    content: "Phase D: Commit V4 to patient0 and push with Zaisam's token"
    status: completed
isProject: false
---

# V4 patient portal: mockups in the Aetheria theme

## Interpretation of "no delta"

Layout, hierarchy, content, and interactions match the mockups exactly. Colours, typography, and surfaces are translated to the clinic portal's tokens from [src/styles.css](src/styles.css): mockup teal → butter accent (`#eed488`, ink `#7a6220`) for CTAs/active states, mockup greens → `--success #4a9d75` for checks/progress, deep navy text → ink `#2f3f66`, white cards → glass surfaces with the notebook-lines background, serif headings → Space Grotesk. Branding becomes Aetheria ("Aetheria Skin Clinic", patient Emma Carter kept). Workspace rules honoured: no left accent rails, pill tab controls sit right of titles.

## Screens (from docs/patient-portal/v3/mockups)

- Home: greeting, 4 stat tiles (current plan, completion ring 43%, next appointment, clinician), clinic news, special offers, next-appointment card with Confirm/Reschedule, plan progress track, latest clinic message with Reply, quick actions, encouragement banner.
- Skin Plan & Journey — Overview: plan header with KPI strip, Today/Next action card, Recovery Check-in sliders with irritation warning, Before & After progress with improvements list, Journey Snapshot (3 month columns of milestones), Safe to Proceed checklist.
- Timeline: month-grouped roadmap with milestone status chips, right-hand Step Details panel (checklist, clinician guidance, managed-by-clinic note), and the Pause Plan modal (reason select with validation error state, notes with counter, info note, Cancel/Submit).
- Journal: filter chips, dated entries with photos/tags/voice-note player, month calendar with marked days, Share Journal card, New entry button.
- Skincare Routine (combined per your choice): Routine 2's layout — AM/PM product columns with usage instructions, adherence ring (71%), Upcoming reminder with Mark as complete/Snooze 1 hour, Skin response, Practitioner note, Product guide — but the recommendation banner uses Routine 1's design with the practitioner's photo.
- My Clinic: clinician card, clinic details with map placeholder, upcoming/completed treatments, other-clinics treatment history table with Add past treatment.
- My Profile / Records: personal details, emergency contact, medical history, treatment history timeline, Results & Labs, Clinic documents, Before & After archive banner.
- Stub pages so every nav item works: Appointments, Billing, Settings, Resources, Messages.

## Build (dependency-ordered phases, work logs per phase)

**Phase 0 — scaffold + theme (no dependencies).** New `docs/patient-portal/v4` cloned from the v3 tooling (Vite + React 19 + react-router 7, same scripts), package renamed `aetheria-portals-v4` v4.0.0; prune v3's portals/decks. Port the clinic tokens into `src/styles/aetheria.css` (palette, glass card, shadows, notebook wash, Space Grotesk via Google Fonts in index.html). Copy avatar + skin-photo assets from the main app's `public/` for people/products/before-afters. Launcher page listing all screens.

**Phase A — mock data service.** `src/mock/` seed + api in the v3 pattern: patient, clinician, plan (3-Month Microneedling, 12 milestones, 43%), month-grouped milestones with step details/checklists, journal entries (tags, photos, voice note), AM/PM routines with adherence + reminder, recovery check-in values, clinic info, news/offers, messages, upcoming/completed treatments, other-clinic history, records (personal/emergency/medical, labs, documents).

**Phase B — shell + shared UI.** Sidebar (Home, Skin Plan & Journey with sub-items, My Clinic, My Profile / Records, Appointments, Billing, Settings; Support: Resources, Messages with badge; "Need help?" footer card), top bar (bell badge, mail, avatar), and shared pieces: stat tile, glass card, tab pills, progress ring, milestone track, labelled sliders, timeline list, data table.

**Phase C — the seven pages + stubs**, one todo each, matching the mockups element-for-element (including the pause modal and step-details panel on Timeline).

**Phase D — screenshot comparison + ship.** Playwright captures every page at the mockup aspect ratio; composite side-by-side sheets (mockup vs V4) like the earlier card comparison; iterate until layout parity; `npm run typecheck`; commit to `patient0` and push with Zaisam's token. Comparison sheets saved under `docs/patient-portal/v4/comparisons/` so you can review and freeze the design.