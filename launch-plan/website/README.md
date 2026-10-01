# SQINOS website

Astro static site, served at `/` by `launch-plan/gateway` (same URL as the demo app). The site is branded SQINOS;
the app behind the demo links is still branded Aetheria until it is renamed.

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
| W1 Hero       | First-visit loader (droplet → S, ≤ 1.1 s). Serum-drop hero in plain WebGL (`src/scripts/hero-gl.ts`, about 4 KB gzipped, no three.js): the drop falls, its ripple reveals the headline, then a lens bead follows the pointer. SVG journey-thread fallback when motion is reduced, data saving is on or WebGL is missing |
| W2 Home story | Two doors (patient / clinic) with live micro-scenes. Pinned five-chapter journey with coded app screens (`JourneyScreen.astro`, from the SQINOS mock-ups) that animate in per chapter. Clinic OS bento with coded mini-UIs. Patient journal story (`Journal.astro`). Safety seal with count-ups. Role cards with marquee. Closing aurora CTA |

JavaScript is about 57 KB gzipped in total (GSAP + Lenis are most of it).

## Pages

| Path       | Contents                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`        | Home story (above)                                                                                                                                                                                             |
| `/pricing` | Four tiers with a Monthly / Annually pill, the "on every plan" list, an unnamed market comparison and an FAQ. Every number lives in `src/lib/pricing.ts`; nothing is hard-coded in the page                     |
| `/contact` | Talk to sales / General enquiry pill (`?topic=sales&plan=clinic` preselects it from the pricing page). Posts to a form service, or falls back to a prefilled email. Honeypot field; no key = mailto fallback  |
| `/demo`    | Mac window with the demo clip, then five "try the live demo" persona cards (owner, manager, practitioner, front desk, patient). Drop the clip at `public/media/sqinos-demo.mp4` (optional poster `sqinos-demo-poster.webp`); until it exists a placeholder shows |
| `/login`   | Split sign-in page (clinic team / patient)                                                                                                                                                                     |

Shared pieces: `Pill.astro` (segmented control, same size and states as the app), `MacWindow.astro`, and the
`.page`, `.page-header`, `.page-title`, `.page-subtitle` helpers in `global.css`. A pill always sits to the right of
the title on the same row; on phones the subtitle drops under both.

## Where links go

Set these in `website/.env.local` (see `.env.example`). Defaults use the gateway's demo entry points.

| Variable                    | Default                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `PUBLIC_CLINIC_SIGNIN_URL`  | `/demo/enter?role=owner`                                       |
| `PUBLIC_PATIENT_SIGNIN_URL` | `/demo/enter?role=patient`                                     |
| `PUBLIC_DEMO_PERSONAS`      | `true` (owner / manager / practitioner / front desk buttons on `/login`) |
| `PUBLIC_CONTACT_EMAIL`      | `contact.sqinos@gmail.com` (shown on `/contact`; the form's fallback address) |
| `PUBLIC_CONTACT_FORM_KEY`   | empty (Web3Forms access key; without it the form uses mailto)  |
| `PUBLIC_CONTACT_FORM_ENDPOINT` | `https://api.web3forms.com/submit`                          |
| `SITE_URL`                  | used for canonical and Open Graph URLs                         |

The site must not use paths the app owns (`/auth`, `/portal`, `/dashboard`, `/my-record`, `/patients`, `/api`…).
Add new top-level pages to `gateway/routes.json` as well.

`/login` is the demo's only sign-in page. The gateway redirects the app's `/auth` and `/portal` here, and the app
itself (in demo mode with `DEMO_SIGNIN_URL=/login`) comes back here on Sign out. `?idle=1` and `?role=unknown` show a
one-line notice above the two doors; `#patient` scrolls to the patient door. `launch-plan/qc/run.sh` checks every
link, demo entry and return path automatically.

## Accessibility and motion

- Real `<h1>` in the DOM even while WebGL paints it. Skip link, visible focus, keyboard-operable slider and menus.
- `prefers-reduced-motion`: no loader, no WebGL, no smooth scroll, no pinning; journey becomes a stacked list.
- **Pause motion** buttons (footer and Clinic OS section) stop looping animations (WCAG 2.2.2) and freeze the hero.

## Content choices to review

- **The journal section is an illustration** built in code and labelled as demo content. `BeforeAfter.astro` is no
  longer on the home page but is kept for later. If it returns, the before/after is an illustration; replace it with
  real, consented, unfiltered photos of skin-quality treatments only. Never use toxin results (ASA/CAP).
- **No testimonials yet.** The "Everyone in the room" section describes each role in product voice. Add quotes only
  when they are real and permissioned.
- **Journey screens are coded mock-ups** (`JourneyScreen.astro`, one `kind` per chapter; the demo page reuses the
  `book` screen as its placeholder). They come from the SQINOS mock-ups, with the brand shown as SQINOS and the
  fictional clinic named Harper Skin Clinic. Some parts are not built in the app yet: the diary's front desk panel and "now" line, the patient
  record Overview tab, the routine reminders layout, the pause request with reason and length, and the offer card in
  the patient portal. The journey intro says so. The patient screens follow a microneedling plan; the clinic diary
  legend still lists anti-wrinkle, which is fine on clinic-facing pages.
- **Screenshots from the demo fixture** are still used by the two doors (clinic dashboard and patient home). The
  patient home shows an "Anti-Wrinkle Maintenance Plan"; swap it before the site is aimed at the public. UK rules bar
  promoting prescription-only medicines to the public.
- Figures in the Safety section are product facts: 161 permission-checked server actions, 8-year retention,
  43 clinic-isolated tables. The bento's Where to focus rows are demo figures.
- **Pricing is a proposal.** Solo £79, Clinic £229, Group £449, Enterprise custom (ex VAT; annual billing = ten
  months). It was set against published UK prices in September 2026: entry tiers from free to about £50 for one user,
  per-login tiers of about £49 to £118, team bands of about £160 to £310 per location plus £65 to £99 for the
  add-ons that cover a patient portal, automation or AI, and flat-rate newcomers at £249 to £499. The comparison
  block quotes a £290 to £480 range for a clinic with four practitioners and two front desk staff, and names no
  competitor. Change the numbers in `src/lib/pricing.ts` before anything is signed.
- "How it works", "For clinics" and "For patients" still point to sections on the home page. Journal, Watch,
  Compliance and Legal are not built yet.

## Hosted preview (website only)

`node scripts/artifact-build.mjs` builds a copy into `artifact/` with `PUBLIC_PREVIEW_MODE=true`: relative asset
paths, `_astro/` renamed to `assets/`, and demo buttons that open a short note instead of the app. This is what the
claude.ai preview page is published from. It is git-ignored.

`node scripts/standalone-build.mjs [outDir]` writes `home.html` and `login.html` with every style, script, font and
image inlined, so each opens on its own from a folder or a design canvas (default `standalone/`, git-ignored).
