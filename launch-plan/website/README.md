# Aetheria website

Astro static site, served at `/` by `launch-plan/gateway` (same URL as the demo app).

```bash
cd launch-plan/website
npm install
npm run dev        # http://localhost:4321 while editing (sign-in links need the gateway)
npm run build      # writes dist/, which the gateway serves
```

`start-public.sh` builds it on the first run. After edits, run `start-public.sh --rebuild`.

## What's built (stages W0–W2)

| Stage         | Contents                                                                                                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0 Foundation | Tokens copied from the app's `src/styles.css`, Space Grotesk + Instrument Serif (self-hosted), glass top bar with **Sign in ▾** and **Explore the demo**, footer with a motion pause, `/login` split page, designed 404                                                                                                 |
| W1 Hero       | First-visit loader (droplet → Æ, ≤ 1.1 s). Serum-drop hero in plain WebGL (`src/scripts/hero-gl.ts`, about 4 KB gzipped, no three.js): the drop falls, its ripple reveals the headline, then a lens bead follows the pointer. SVG journey-thread fallback when motion is reduced, data saving is on or WebGL is missing |
| W2 Home story | Two doors (patient / clinic) with live micro-scenes. Pinned six-chapter journey using real portal screenshots. Clinic OS bento with coded mini-UIs. Before/after slider. Safety seal with count-ups. Role cards with marquee. Closing aurora CTA                                                                        |

JavaScript is about 57 KB gzipped in total (GSAP + Lenis are most of it).

## Where links go

Set these in `website/.env.local` (see `.env.example`). Defaults use the gateway's demo entry points.

| Variable                    | Default                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `PUBLIC_CLINIC_SIGNIN_URL`  | `/demo/enter?role=owner`                                       |
| `PUBLIC_PATIENT_SIGNIN_URL` | `/demo/enter?role=patient`                                     |
| `PUBLIC_DEMO_PERSONAS`      | `true` (owner / practitioner / front desk buttons on `/login`) |
| `PUBLIC_CONTACT_EMAIL`      | empty (adds a "Talk to us" button when set)                    |
| `SITE_URL`                  | used for canonical and Open Graph URLs                         |

The site must not use paths the app owns (`/auth`, `/portal`, `/dashboard`, `/my-record`, `/patients`, `/api`…).
Add new top-level pages to `gateway/routes.json` as well.

## Accessibility and motion

- Real `<h1>` in the DOM even while WebGL paints it. Skip link, visible focus, keyboard-operable slider and menus.
- `prefers-reduced-motion`: no loader, no WebGL, no smooth scroll, no pinning; journey becomes a stacked list.
- **Pause motion** buttons (footer and Clinic OS section) stop looping animations (WCAG 2.2.2) and freeze the hero.

## Content choices to review

- **Before/after is an illustration**, generated in code and labelled as such. Replace it with real, consented,
  unfiltered photos of skin-quality treatments only. Never use toxin results (ASA/CAP).
- **No testimonials yet.** The "Everyone in the room" section describes each role in product voice. Add quotes only
  when they are real and permissioned.
- **Screenshots come from the demo fixture.** Several patient-portal screens show an "Anti-Wrinkle Maintenance
  Plan". Before the site is aimed at the public (not just investors), switch the fixture patient to a skin-quality
  plan, or pick other screens. UK rules bar promoting prescription-only medicines to the public.
- Figures in the Safety section are product facts: 161 permission-checked server actions, 8-year retention,
  immutable signed consents. The bento's 72% retention is labelled as demo data.
- Nav links point to sections on the home page. The deeper pages (For clinics, For patients, Pricing, Journal, Watch,
  Compliance, Legal) come in W3–W5.

## Hosted preview (website only)

`node scripts/artifact-build.mjs` builds a copy into `artifact/` with `PUBLIC_PREVIEW_MODE=true`: relative asset
paths, `_astro/` renamed to `assets/`, and demo buttons that open a short note instead of the app. This is what the
claude.ai preview page is published from. It is git-ignored.
