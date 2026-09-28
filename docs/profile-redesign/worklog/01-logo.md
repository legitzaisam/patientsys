# Phase 1: Sqinos mark and wordmark, favicon

Branch `e2e_live`, on top of `786cf13`. 28 Sep 2026.

### p1-01-assets

- `public/sqinos-mark.svg`, `public/sqinos-mark-inverse.svg`, `public/favicon.svg`: copied from `Claude outputs/sqinos-logo/` with the C2PA `<metadata>` block and its `xmlns:c2pa` attribute stripped (8 KB → under 500 bytes each; the drawing is unchanged).
- `public/favicon.ico`: rebuilt from `favicon-64.png` as a PNG-in-ICO container with 16, 32 and 64 px entries (macOS `sips` for the downscales, the ICO directory written by hand; no Pillow or sharp on this machine). `file` reports "MS Windows icon resource - 3 icons".
- Checked: both files served 200 from the dev server (`/favicon.svg` as `image/svg+xml`, `/favicon.ico` 10,501 bytes).

### p1-02-brandmark

- `src/components/brand-mark.tsx`: `BrandMark` now draws the ring-and-drop inline (`viewBox 0 0 100 100`, ring `var(--foreground)` for the `gold` variant and `#f6f7f8` for `on-gold`, the drop's radial gradient `#fffaf0 → #eed488 → #c9a64a` from the source file). Same 28 / 30 px sizes and `aria-hidden`; the old butter chip background is gone because the mark carries its own colour.
- Checked: clinic sidebar and patient portal sidebar (gold variant on the cream surface), `/auth` and `/portal` (on-gold variant on the butter panel), landing page — `captures/p1-logo/*.png`.

### p1-03-wordmark

- `BrandLockup` wordmark reads `SQINOS` with `tracking-[0.06em]`; `light`, `to`, `size`, `variant` props unchanged, so the eight call sites (`app-shell`, `auth`, `auth.callback`, `auth.reset`, `portal`, `index`, `d.$token`, `u.$token`) needed no edits.
- `e2e/patient-portal/navigation.spec.ts:94`: the brand-link test looked the link up by `/Aetheria/i`; renamed to `/SQINOS/i` in the same commit.

### p1-04-favicon-link

- `src/routes/__root.tsx`: `{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }` added before the `.ico` link; every page now lists both (checked on dashboard, portal home, `/auth`, `/portal`, `/`).

### p1-05-verify-commit

| Check | Result |
| ----- | ------ |
| Screenshots | `captures/p1-logo/` clinic-sidebar, portal-sidebar, auth, portal-login, landing |
| tsc | 116 = baseline (one line-number shift in `__root.tsx`) |
| Lint | `brand-mark.tsx` 0 → 0 (Prettier-formatted), `__root.tsx` 0 → 0, `navigation.spec.ts` 0 |
| e2e | `patient-portal/navigation.spec.ts` brand link passes; `smoke.spec.ts` 26 / 26 |

Not changed: route `<title>` strings and the sign-in email copy still say "Aetheria" (flagged in the plan as a follow-up question).
