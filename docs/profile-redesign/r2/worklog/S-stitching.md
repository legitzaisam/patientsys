# Phase S: website ↔ demo stitching — audit, restore, QC, commit

Branch `e2e_live`, on top of `fc1f672`. 29 Sep 2026. The report was "when we click All Patients / Clinic or Patient Portal, or Login → Clinic / Patient, we land in the demo without a login page — make sure that flow works". Everything below is evidence that the flow itself is intact and that what broke was the *stack*: nothing was serving the website in front of the app.

### r2-ps-01-audit

| What | Found |
| ---- | ----- |
| Ports | 8090 (app), 8094 / 8097 (QC) free; **8099 held by the raw demo app I started for profile testing** — the port the gateway is meant to own. So `http://localhost:8099/` showed the app, not the website, and every website link was out of reach |
| Git state | `launch-plan/**` (gateway, website sources, ngrok scripts, `qc/`) modified or untracked; the seven app hand-off files (`src/routes/auth.tsx`, `portal.tsx`, `index.tsx`, `src/components/app-shell.tsx`, `src/lib/demo/enabled.ts`, `src/lib/demo/handoff.ts`, `vite.config.ts`) uncommitted since the stitching plan |
| Website build | `dist/index.html` 28 Sep 20:25; `links.ts`, `login.astro`, `demo.astro` touched 29 Sep 01:14 → stale build (content-wise it already carried the manager persona) |
| QC report | last run at `c291ab1`, 40 / 40, before the twelve profile commits |
| Personas three-way | `routes.json demoRoles` = `links.ts` = `login.astro` = `demo.astro` = `{ owner, manager, practitioner, front_desk, patient }`; `Roles.astro` (home "Try this view") shows four (no manager, by design); `Doors`, `ClosingCta`, `Footer`, `TopBar` use `links.clinic` / `links.patient` |
| Handlers on the website | Lenis smooth scroll + `data-reveal` (opacity 0 → 1 on intersection) on desktop; the top-bar Sign in is a button that toggles a hidden panel with the two rows; mobile nav has a plain `/login` link |

### r2-ps-02-before-captures

Stopped the raw app on 8099; started the stack as the launch scripts do — `APP_MODE=dev ./launch-plan/ngrok/start-demo.sh` (app on 8090, `DEMO=1`, `DEMO_SIGNIN_URL=/login`, `APP_ORIGIN=http://localhost:8099`) and `node launch-plan/gateway/server.mjs` (8099, `website/dist`). Then `/tmp/r2-stitch.mjs` (kept for P7) drove Chromium 1440 and WebKit iPhone 15 through sixteen flows each, screenshotting every landing to `captures/before/stitching-<flow>-<device>.jpg`:

| Flow | Desktop lands on | Phone lands on | Cookie |
| ---- | ---------------- | -------------- | ------ |
| Top bar Sign in → Clinic team | `/dashboard`, pill Clinic owner | (mobile nav → `/login` → Clinic owner) `/dashboard` | owner |
| Top bar Sign in → Patients | `/my-record`, pill Patient | `/my-record` | patient |
| Home "See the clinic portal" | `/dashboard` | `/dashboard` | owner |
| Home "See the patient portal" | `/my-record` | `/my-record` | patient |
| `/login` → Clinic owner / Manager / Practitioner / Front desk / Patient | `/dashboard` ×4 with the matching pill (Receptionist for front desk), `/my-record` | same | each role |
| `/demo` cards owner / patient | `/dashboard` / `/my-record` | same | owner / patient |
| Full load `/auth`, `/portal`, `/auth?idle=1` | website `/login`, `/login#patient`, `/login?idle=1` | same | none |
| Sign out from the dashboard | website `/login`, cookie cleared | same | none |
| App 404 → Go home | website `/` | same | none |

32 / 32 land where they should, no login page in between. Two script-side lessons, not product faults: the desktop Doors CTA must be clicked after the reveal transition settles (a forced click at 600 ms hit stale coordinates); the top-bar rows need the Sign in button clicked first (they are `hidden` until then).

### r2-ps-03-gateway-tests

`node launch-plan/gateway/test.mjs` → 12 / 12 (routing table, `/demo/enter` for every role and the unknown role, `next` accepted / rejected, `/auth` → `/login` with `idle` carried, `/auth/callback` untouched, host roots, traversal refused, websocket upgrade). Nothing to fix.

### r2-ps-04-website-rebuild

`npm run build` in `launch-plan/website` (Astro, 6 pages, 0.8 s) so `dist` carries the current sources; `routes.spec.ts` (inside the QC run) confirms every page is in `routes.json`, every exact path resolves or is a known placeholder (`/about`, `/investors`, `/sitemap.xml`), personas agree three ways, no website path collides with an app route, and the sign-in redirect table names only exact app sign-in paths.

### r2-ps-05-qc-suite

`./launch-plan/qc/run.sh` at `fc1f672`: throwaway app 8094 + gateway 8097, Chromium desktop and WebKit iPhone 15 → **40 / 40 passed, 411 checks** (`routes` 55, `links` 272, `demo-entry` 50 + 1 skipped, `return-paths` 12, `gateway-health` 14). Nothing needed fixing in the gateway, the website or the hand-off; the twelve profile commits did not move any entry or return path. One text change in `launch-plan/qc/report.ts`: the known-gap line now says the mark and wordmark are SQINOS while the route titles and sign-in email copy still say Aetheria (it claimed the whole app said Aetheria). `REPORT.md` regenerated.

### r2-ps-06-app-handoff-review

- The diff of the seven files is entirely behind `DEMO_MODE && DEMO_SIGNIN_URL`: `enabled.ts` reads the `__DEMO_SIGNIN_URL__` define; `handoff.ts` builds the website URL (`/login`, `/login#patient`, `/login?idle=1`, `/`) and clears the `demo_role` cookie; `auth.tsx` / `portal.tsx` / `index.tsx` replace the location on mount and render nothing when a hand-off applies; `app-shell.tsx` Sign out clears the cookie and hands off instead of navigating to `/auth`; `vite.config.ts` adds the define. Without the variable every path is unchanged.
- `e2e/smoke.spec.ts` + `e2e/rbac.spec.ts` (regression config, no `DEMO_SIGNIN_URL`): 34 / 34. tsc 109 (= baseline). Lint delta 0 on all seven files.

### r2-ps-07-commit

Committed `launch-plan/**` (excluding the ignored `.env.local`, `dist/`, `qc/captures/`, `.run/`) and the seven app files in one commit. The gateway on 8099 and the app on 8090 are left running for a manual click-through: **http://localhost:8099/** is the website; Sign in → Clinic team / Patients, the portal buttons, `/login` and `/demo` all enter the demo directly.

## Phase summary

| Check | Result |
| ----- | ------ |
| Click-through, Chromium + WebKit | 32 / 32 flows land correctly with the stack up |
| Gateway tests | 12 / 12 |
| QC suite (`qc/run.sh`) | 40 / 40, 411 checks, report stamped `fc1f672` |
| smoke + rbac e2e | 34 / 34 |
| tsc / lint | 109 / delta 0 |

Root cause of "it broke": the gateway was not running and its port was taken by the raw app. Nothing in the gateway, website or hand-off had regressed. Still worth doing next time the stack is needed: `./launch-plan/ngrok/start-public.sh --local` (gateway only, no tunnel) rather than a bare `vite dev` on 8099.
