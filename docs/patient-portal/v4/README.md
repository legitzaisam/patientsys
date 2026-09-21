# V4 — patient portal wireframes in the Aetheria theme

A small navigable app that recreates the eight reference mockups in
[../v3/mockups](../v3/mockups) using the clinic portal's exact visual language
instead of the mockups' green-and-white Vivara theme.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
```

`/` is a launcher listing every screen; everything else runs inside the portal
shell, so you can click through the whole thing.

## Screens

| Route | Screen | Reference mockup |
| --- | --- | --- |
| `/home` | Home | Vivara Home |
| `/plan` | Skin Plan & Journey — Overview | Vivara Skin Plan Overview Page |
| `/plan/timeline` | Timeline (+ pause request modal) | Vivara Timeline Page |
| `/plan/journal` | Journal | Vivara Journal Page |
| `/plan/routine` | Skincare Routine | Vivara Skincare Routine 1 + 2 |
| `/clinic` | My Clinic | Vivara My Clinics |
| `/records` | My Profile / Records | Vivara My Profile-Records page |

`/appointments`, `/billing`, `/settings`, `/resources` and `/messages` are
light secondary screens so every nav item leads somewhere; they are not part
of the mockup set.

The Skincare Routine screen combines both routine mockups as agreed: Routine
2's layout (two-column product rows, adherence ring, reminder card with Mark
as complete / Snooze) with Routine 1's practitioner-photo recommendation
banner.

## Theme mapping

Layout, hierarchy, content and interactions follow the mockups. Only the
visual language is translated, using tokens copied from the clinic portal's
[src/styles.css](../../../src/styles.css) into
[src/styles/aetheria.css](src/styles/aetheria.css):

| Mockup | V4 (Aetheria) |
| --- | --- |
| Teal CTAs and active nav | Butter accent `#eed488`, ink `#7a6220` |
| Green progress and ticks | `--success #4a9d75` |
| Deep navy text | Ink `#2f3f66` with `--ink-2` / `--ink-3` |
| Flat white cards | Glass surfaces: translucent fill, blur, lit top edge, sheen |
| Plain page background | Notebook wash: two radial tints plus 14px rules |
| Serif display headings | Space Grotesk throughout |
| Vivara branding | Aetheria / Aetheria Skin Clinic |

Two workspace rules are honoured that the mockups do not follow: no left-edge
colour rails on cards, and tab controls use the portal's segmented pill sitting
on the title row.

## Data

Everything renders from [src/mock/seed.ts](src/mock/seed.ts) — plan and
milestones with per-step checklists and clinician guidance, journal entries,
AM/PM routines, check-in readings, clinic details, records and documents. Copy
is taken from the mockups with the clinic rebranded, so content can be reshaped
without touching layout.

Patient avatars and skin photos are copied from the main app's `public/`.
Clinic interiors and product shots (which we have no assets for) render as
tinted `PhotoBlock` placeholders rather than unrelated stock imagery.

## Comparison sheets

```bash
npm run dev                  # in one terminal
node scripts/capture.mjs     # in another
```

Captures each screen at 1672x941 — the reference mockups' exact pixel size —
and writes side-by-side sheets to [comparisons/](comparisons):
`compare-<screen>.png` (mockup left, V4 right) with the raw captures in
`comparisons/shots/`. Every designed screen fits the frame without scrolling,
matching the mockups.
