# Aetheria

Clinical records software for aesthetic clinics and medspas: patient records, before/after photos, consent and consultation forms, diary/scheduling, treatment recall, and clinic-to-patient messaging.

This repo is a [TanStack Start](https://tanstack.com/start) app. It can run against a live [Supabase](https://supabase.com) project, or in **demo mode** with fixture data and no backend.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Routing / SSR | TanStack Start + TanStack Router (file-based routes) |
| Data | TanStack Query + TanStack Start server functions |
| Auth & DB | Supabase (Postgres, Auth, Storage, RLS) |
| Tooling | Vite 8, ESLint, Prettier |
| Hosting (Lovable) | Nitro / Cloudflare by default |

## Prerequisites

- **Node.js 22+** (LTS recommended) and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- For a real backend: a Supabase project and the [Supabase CLI](https://supabase.com/docs/guides/cli)

```sh
npm i -g supabase
```

## Quick start (demo, no Supabase)

Use this to explore the UI without keys or a database.

```sh
git clone https://github.com/legitzaisam/patientsys.git
cd patientsys
npm i
npm run dev:demo
```

Open [http://localhost:8080](http://localhost:8080). Demo mode swaps `src/lib/clinic.functions.ts` for fixture data in `src/lib/clinic.functions.demo.ts`.

### Demo accounts and roles

The root `/` is the app's public landing page (Staff sign in, Patient portal) and looks the same in demo and live mode; the demo itself starts at [`/dashboard`](http://localhost:8080/dashboard) for staff and [`/my-record`](http://localhost:8080/my-record) for the patient. In demo mode the server trusts a `demo_role` cookie, so **no password is checked**. Pick a role in any of three ways:

1. **The Demo pill** (bottom-left of every page) switches persona in place.
2. **A URL**, when the app runs behind `launch-plan/gateway`: `/demo/enter?role=owner|manager|practitioner|front_desk|patient` (the gateway does not route `admin`; use the pill for that).
3. **Signing in** at `/auth` (staff) or `/portal` (patients) with one of the emails below: the app maps the email onto the persona. This route needs a real Supabase project in `.env` where the account exists. The passwords listed are the ones `scripts/provision-staff.mjs` creates there; roles marked "pill only" have no account provisioned by the scripts.

| Role (`demo_role`) | Persona you become | Sign-in email | Password | Lands on |
| ------------------ | ------------------ | ------------- | -------- | -------- |
| `owner` (clinic owner) | Dr Amara Osei, Clinic Director | `amara.osei@aetheria.clinic` | Whatever `OWNER_PASSWORD` was given to `scripts/provision-remote.mjs` or `scripts/ensure-owner.mjs`; not stored in the repo | `/dashboard` |
| `manager` | Maya Chen, Clinic manager | `maya.chen@aetheria.clinic` | Pill only (no account provisioned) | `/dashboard` |
| `practitioner` | Dr Nadia Rahman, Aesthetic Practitioner | `nadia.rahman@aetheria.clinic` | `Practitioner1!` | `/dashboard` |
| `practitioner` | Dr Tom Whitfield, Aesthetic Doctor | `tom.whitfield@aetheria.clinic` | `Practitioner2!` | `/dashboard` |
| `front_desk` (receptionist) | Sofia Marchetti, Patient Coordinator | `sofia.marchetti@aetheria.clinic` | `Reception1!` | `/dashboard` |
| `patient` | Olivia Bennett | `olivia.bennett@example.com` | Pill only (no account provisioned); sign in at `/portal` if one is created | `/my-record` |
| `admin` (software admin) | Software developer | `developer@aetheria.clinic` | `Developer1!` | `/access` |

The fixture clinic is Aetheria; all names, patients and numbers are demo data. Emails and texts stay in a sandbox.

## Launching the Sqinos application (website + clinic portal + patient portal)

`npm run dev:demo` above runs the portal on its own. The **whole** Sqinos experience is three pieces served from one address:

```
launch-plan/website/dist  (static Astro marketing site)  ┐
                                                         ├─> gateway :8099  ──>  http://localhost:8099
app in demo mode          (clinic portal + patient portal) ┘   (optionally ──> ngrok ──> public https URL)
```

The **gateway** (`launch-plan/gateway/server.mjs`, plain Node, no dependencies) answers the website's paths (`/`, `/login`, `/pricing`, `/contact`, `/demo`, `/for-clinics/…`, `/for-patients/…`, `/journal/…`, …; the full list is `launch-plan/gateway/routes.json`) from the static build and proxies everything else (`/dashboard`, `/patients`, `/tasks`, `/my-record`, `/api/…`, websockets) to the app. Behind the gateway the website's `/login` owns sign-in: the app's `/auth` and `/portal` redirect there, and `/demo/enter?role=…` drops you into a persona.

Everything below is local only (nothing leaves your machine) and needs **three terminals**, or one terminal plus `--background`. Run every command from the repository root.

### 1. Prerequisites (once)

```sh
node -v          # 22 or newer (both package.json files pin engines >= 22)
npm i            # app dependencies, if you have not already
cd launch-plan/website && npm i && cd ../..   # website dependencies (Astro)
```

`launch-plan/.env.local` is optional for a local launch. The scripts default to `APP_PORT=8090`, `GATEWAY_PORT=8099`, `DEMO_DEFAULT_ROLE=owner`; it only becomes necessary for ngrok (`NGROK_DOMAIN`, see step 8). Never commit it.

### 2. Check the ports are free

```sh
lsof -nP -iTCP:8090 -sTCP:LISTEN   # app
lsof -nP -iTCP:8099 -sTCP:LISTEN   # gateway
```

Both should print nothing. If something else already holds 8090 (any other project's dev server), **do not kill it**; pick another port for the app and use it in steps 4 and 5 (`APP_PORT=8092` is used as the example throughout). The gateway will happily proxy to whatever is on the port you give it, so a wrong or busy port shows you a different application, not an error.

### 3. Build the website

The gateway serves a static build, so the site has to be built once (and again after every edit under `launch-plan/website/src`):

```sh
cd launch-plan/website && npm run build && cd ../..
ls launch-plan/website/dist/index.html          # must exist
```

Takes about a second; prints `[build] 6 page(s) built`.

### 4. Start the app in demo mode — terminal 1

```sh
APP_MODE=dev ./launch-plan/ngrok/start-demo.sh
# if 8090 is taken:
APP_MODE=dev APP_PORT=8092 ./launch-plan/ngrok/start-demo.sh
```

The script refuses to start if the port is busy (`Port 8090 is busy…`). It sets `DEMO=1`, points the app's sign-in links at the website (`DEMO_SIGNIN_URL=/login`), tells the app its public origin (`APP_ORIGIN=http://localhost:8099`) and, when there is no `.env`, exports placeholder Supabase values so the browser client can load. It then runs `vite dev --port <APP_PORT> --strictPort --host 127.0.0.1` in the foreground. Wait for:

```
VITE v8.x  ready in …
➜  Local:   http://127.0.0.1:8090/
```

Confirm it is **this** app before going on (the title must be Aetheria's):

```sh
curl -s http://127.0.0.1:8090/tasks | grep -o '<title>[^<]*'    # → <title>Tasks — Aetheria
```

`APP_MODE=preview` (the default when the variable is omitted) builds a production bundle first and serves that instead; it is what the public launch uses because it makes about an eighth of the requests per page. For local work `dev` is faster to start and hot-reloads.

### 5. Start the gateway — terminal 2

```sh
GATEWAY_PORT=8099 APP_PORT=8090 \
WEBSITE_DIST="$PWD/launch-plan/website/dist" \
DEMO_DEFAULT_ROLE=owner GATEWAY_QUIET=1 \
node launch-plan/gateway/server.mjs
```

Use the same `APP_PORT` as in step 4. It prints:

```
Aetheria gateway on http://localhost:8099
  website: …/launch-plan/website/dist
  app:     http://127.0.0.1:8090
```

`GATEWAY_QUIET=1` turns off the per-request log line; drop it to see every request. `DEMO_DEFAULT_ROLE` is the persona `/demo/enter` uses when the link carries no `?role=`. (An app URL opened with no persona cookie at all renders as the owner: that is the demo server's own default.)

### 6. Verify — terminal 3

```sh
for p in / /login /demo /contact /dashboard /patients /tasks /my-record; do
  printf '%-11s %s  ' "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8099$p)"
  curl -s "http://localhost:8099$p" | grep -a -o '<title>[^<]*' | head -1
done
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://localhost:8099/auth     # 302 -> …/login
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://localhost:8099/portal   # 302 -> …/login#patient
node launch-plan/gateway/test.mjs                                                          # # pass 12 / # fail 0
```

Expected: every path `200`; website titles `SQINOS — …`, `Sign in · SQINOS`, `Demo · SQINOS`; app titles `… — Aetheria`. `test.mjs` is self-contained: it spins up a stub app and its own gateway on 18090/18099, checks the routing rules (website paths, proxying, sign-in redirects, `/demo/enter`, websockets) and exits, so it neither needs nor touches steps 4–5. The `curl` lines above are what prove the real stack.

### 7. Use it

| Open | What you get |
| ---- | ------------ |
| [http://localhost:8099/](http://localhost:8099/) | Marketing website (a short intro animation with the drop mark plays first) |
| [http://localhost:8099/login](http://localhost:8099/login) | Sign in: pick a staff persona, or the patient under `#patient` |
| [http://localhost:8099/demo](http://localhost:8099/demo) | Demo page; `/demo/enter?role=owner\|manager\|practitioner\|front_desk\|patient` jumps straight in |
| [http://localhost:8099/dashboard](http://localhost:8099/dashboard) | **Clinic portal** (Dashboard, Diary, Patients, Tasks, Team, reports) as the current persona — owner by default |
| [http://localhost:8099/my-record](http://localhost:8099/my-record) | **Patient portal** (Olivia Bennett's plan, timeline, messages) |
| Demo pill, bottom-left of any app page | Switch persona in place (this is also where `manager` and `admin` live) |
| Sign out (top-right menu) | Returns to the website's `/login` |

Everything is fixture data: no Supabase, no real email or SMS. The app hot-reloads code changes; the website does not (rebuild, step 3, and reload).

### 8. Public URL (optional, ngrok)

To show it from outside your Mac, `launch-plan/ngrok/start-public.sh` does steps 3–5 in one go (`--rebuild` to rebuild the site first), then opens an ngrok tunnel to `https://$NGROK_DOMAIN`. It needs the one-time ngrok set-up (authtoken, free reserved domain) in `launch-plan/.env.local`; `./launch-plan/ngrok/doctor.sh` checks all of it. Full instructions: [`launch-plan/README.md`](launch-plan/README.md). It too defaults to `APP_PORT=8090`, so free that port or set `APP_PORT` first.

### 9. Stop

- Foreground (steps 4–5): `Ctrl-C` in each terminal.
- Background: start the app with `./launch-plan/ngrok/start-demo.sh --background` (pid in `launch-plan/.run/app.pid`, log in `.run/logs/app.log`) and stop everything the scripts started with `./launch-plan/ngrok/stop.sh`. The gateway from step 5 has no pid file, so stop it with `kill $(lsof -nP -iTCP:8099 -sTCP:LISTEN -t)`.

### If something is off

| Symptom | Cause / fix |
| ------- | ----------- |
| `Port 8090 is busy. Stop whatever uses it or change APP_PORT.` | Another server has the port (`lsof -nP -iTCP:8090 -sTCP:LISTEN` names it). Use `APP_PORT=8092` in steps 4 and 5. |
| App pages through the gateway show a **different product** | The gateway is proxying to whatever sits on `APP_PORT`. Check `curl -s http://127.0.0.1:<APP_PORT>/tasks \| grep -o '<title>[^<]*'` says Aetheria; restart the gateway with the right port. |
| `The demo app is not reachable on port …` page from the gateway | Step 4 is not running, or on a different port than the gateway's `APP_PORT`. |
| Website paths answer `503 The website is not built yet` | Step 3 was skipped, or `WEBSITE_DIST` points elsewhere: build the site and restart the gateway with the path from step 5. |
| Website shows old content | The static build is stale; rebuild (step 3) and hard-reload. |
| Only the app, no website, is wanted | `npm run dev:demo` on port 8080 (Quick start above). |

## Redeploying www.sqinos.com after a change

The public site runs from this Mac through a Cloudflare Tunnel: `caffeinate -dims ./launch-plan/cloudflare/start-public.sh` inside `tmux attach -t sqinos` serves **snapshots** of the website and the demo app (under `launch-plan/.run/`) behind the gateway on 8099, and `cloudflared` carries them to **https://www.sqinos.com** (HTTP/2 to Cloudflare). Pulling new code does not change what visitors see until a snapshot is swapped, so after every change:

```sh
cd ~/Downloads/"Lovable project"
git pull                                   # the connected branch (e2e_exp)
npm ci                                     # only when package.json / package-lock.json changed
./launch-plan/cloudflare/redeploy.sh app   # clinic portal or patient portal changed (src/**, fixtures)
```

Run it from the repo root in any terminal; the tmux window keeps running. Pick the argument by what changed:

| You changed | Run | Effect |
| --- | --- | --- |
| The app: clinic portal or patient portal (`src/**`, fixtures in `src/lib/demo`, demo options in `launch-plan/.env.local`) | `./launch-plan/cloudflare/redeploy.sh app` | Rebuilds the demo bundle (1–2 min, the old app keeps serving), then restarts it (~3 s of "not reachable"). Demo data resets |
| The website (`launch-plan/website/src/**`, `public/**`, `website/.env.local`) | `./launch-plan/cloudflare/redeploy.sh website` | Rebuilds Astro (~5 s) and swaps the snapshot. No restart |
| Both, or not sure | `./launch-plan/cloudflare/redeploy.sh all` | Website first, then the app |
| The gateway (`launch-plan/gateway/*`) | `./launch-plan/cloudflare/stop.sh`, then `caffeinate -dims ./launch-plan/cloudflare/start-public.sh` again in tmux | The gateway is not snapshotted; run `node launch-plan/gateway/test.mjs` first |
| Nothing, but the site is unreachable after a VPN or Wi-Fi change | `./launch-plan/cloudflare/redeploy.sh tunnel` | Restarts only `cloudflared` |

Before a `website` redeploy, make sure `launch-plan/website/.env.local` carries the contact address the site should show: `PUBLIC_CONTACT_EMAIL=contact.sqinos@gmail.com` (the build falls back to that address when the variable is empty).

Then check it took:

```sh
./launch-plan/cloudflare/status.sh                 # processes, local and public health
curl -sI https://www.sqinos.com/healthz | head -1  # HTTP/2 200
```

Cloudflare needs no cache purge: asset file names are content-hashed and HTML is not cached at the edge. A tab that was open during an `app` redeploy may say **"server function not found"** on its next click because it still holds the old bundle; a hard reload (`Cmd-Shift-R`) fixes it. Logs are in `launch-plan/.run/logs/` (`app`, `app-build`, `gateway`, `cloudflared`, `website-build`). The full runbook, first-time setup and troubleshooting table are in [`launch-plan/cloudflare/README.md`](launch-plan/cloudflare/README.md).

## Local development (live Supabase)

```sh
git clone https://github.com/legitzaisam/patientsys.git
cd patientsys
npm i
cp .env.example .env
```

Fill `.env` from the Supabase dashboard (**Project Settings → API**), then:

```sh
npm run dev
```

The app serves at **http://localhost:8080**.

### Environment variables

There is **one** Supabase project. Values are duplicated because Vite only exposes names that start with `VITE_` to the browser.

| Variable | Where it is read | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser (`src/integrations/supabase/client.ts`) | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Publishable / anon key only |
| `VITE_SUPABASE_PROJECT_ID` | Browser | Project ref |
| `SUPABASE_URL` | Server (`process.env`) | Same URL as the `VITE_` copy |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Used to verify user JWTs |
| `SUPABASE_PROJECT_ID` | Server / CLI | Same ref as `VITE_` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Never** prefix with `VITE_`. Bypasses RLS. Required for server functions on this project |
| `DATABASE_URL` / `DATABASE_PASSWORD` | Optional | Direct Postgres, for `scripts/apply-migrations.mjs` |

Keep each `VITE_*` value identical to its non-`VITE_` counterpart. Commit `.env.example`, never `.env`.

### First-time Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL and **publishable** key into `.env` (both `SUPABASE_*` and `VITE_SUPABASE_*`).
3. Copy the **service_role** secret (or `sb_secret_…` key) into `SUPABASE_SERVICE_ROLE_KEY`.
4. Log in with the CLI and push schema:

```sh
supabase login
supabase db push --project-ref <your-project-ref> --yes
```

The first migration enables `pgcrypto` (needed for `gen_random_bytes` on document access tokens). If a push fails halfway, fix the SQL, then push again — that migration is written to be re-runnable.

5. Create storage buckets and an owner account (schema must already exist):

```sh
OWNER_EMAIL='you@example.com' \
OWNER_PASSWORD='choose-a-strong-password' \
OWNER_NAME='Your Name' \
node scripts/provision-remote.mjs
```

This creates buckets `patient-photos`, `message-attachments`, and `staff-files`, confirms the user, and grants the **owner** (manager) role.

Sign in at [http://localhost:8080/auth](http://localhost:8080/auth).

### Live accounts and roles

The linked project is `aljozsxrdqfxiqczhbqn`, clinic **Aetheria Medical**. This roster was read from the project on 28 September 2026 (Auth users joined to `user_roles` and `profiles`). Supabase only stores password hashes, so a password appears below only when the repo sets it: the four staff logins that `scripts/provision-staff.mjs` creates (`ONLY=<email> node scripts/provision-staff.mjs` resets one of them to the scripted value). Anyone whose password the owner has since changed from **Team** keeps the changed one. The live roster is not the demo cast: there is no Amara Osei, Maya Chen or Olivia Bennett account here.

| Role (`user_roles`) | Account | Sign-in email | Password | Signs in at → lands on | Last sign-in |
| ------------------- | ------- | ------------- | -------- | ---------------------- | ------------ |
| `owner` | Zaisam Al-Dulimi, Clinic Owner | `zaisam_aldulimi@hotmail.co.uk` | Set by `OWNER_PASSWORD` when the project was provisioned; held by Zaisam | `/auth` → `/dashboard` | 27 Sep 2026 |
| `manager` | Test Manager, Practice Manager | `test.manager@aetheria.clinic` | Held outside the repo (see `docs/WORKLOG.md`, Phase 1 roster); a disposable test account | `/auth` → `/dashboard` | 26 Aug 2026 |
| `practitioner` | Dr Nadia Rahman, Aesthetic Practitioner | `nadia.rahman@aetheria.clinic` | `Practitioner1!` (scripted) | `/auth` → `/dashboard` | 19 Sep 2026 |
| `practitioner` | Dr Tom Whitfield, Aesthetic Doctor | `tom.whitfield@aetheria.clinic` | `Practitioner2!` (scripted) | `/auth` → `/dashboard` | never |
| `front_desk` | Sofia Marchetti, Receptionist | `sofia.marchetti@aetheria.clinic` | `Reception1!` (scripted) | `/auth` → `/dashboard` | 25 Sep 2026 |
| `admin` | Software developer | `developer@aetheria.clinic` | `Developer1!` (scripted) | `/auth` → `/access` | 25 Sep 2026 |
| `patient` | Damon Salvatore | `damonsalvatore@hotmail.com` | Held outside the repo (`docs/WORKLOG.md`) | `/portal` → `/my-record` | 26 Aug 2026 |
| none | Zainab Bassim (profile says Manager) | `z.bassim@hotmail.com` | Cannot sign in: no `user_roles` row, so every sign-in ends in "Your clinic access has been removed" until the owner grants a role from Team | — | 23 Aug 2026 |

Two things the roster showed, worth acting on:

- **The live database is behind the code.** `profiles.clinic_role_id` does not exist in the project, so the five migrations dated `20260930…` (profile governance, clinic set-up and named roles, approvals opt-in, inbox cleared, alert replies) have not been applied. The current code will fail on the Team page and anywhere it reads those columns until `supabase db push` or `scripts/apply-migrations.mjs` has run.
- `z.bassim@hotmail.com` is an orphaned account (auth user and profile, no role), as first noted in `docs/WORKLOG.md`.

## npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 8080 (live Supabase) |
| `npm run dev:demo` | Same, with fixture data (`DEMO=1`) |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project layout

```
src/
  routes/                 # File-based routes (see src/routes/README.md)
    __root.tsx            # App shell, error UI
    index.tsx             # Marketing landing page
    auth.tsx              # Staff sign in / sign up
    portal.tsx            # Patient portal sign in
    _authenticated/       # Logged-in clinic UI (ssr: false)
  lib/
    clinic.functions.ts   # Server functions (live data)
    clinic.functions.demo.ts
    permissions.ts
  integrations/supabase/  # Clients, auth middleware, generated types
  components/             # Feature UI + shadcn-style primitives
supabase/migrations/      # Postgres schema, RLS, functions
scripts/                  # One-off provision / migration helpers
```

`src/routeTree.gen.ts` is generated. Do not edit it.

### Routes

| Path | Who |
| --- | --- |
| `/` | Public landing |
| `/auth` | Staff sign in |
| `/portal` | Patient sign in |
| `/dashboard` | Clinic overview |
| `/schedule` | Diary |
| `/patients`, `/patients/:id` | Records |
| `/team`, `/team/:id` | Staff |
| `/retention`, `/performance`, `/earnings` | Reports |
| `/settings`, `/profile` | Clinic / account |
| `/my-record` | Patient’s own record |

Routing conventions (layouts, `$id` params, `<Outlet />`) are documented in [`src/routes/README.md`](src/routes/README.md).

### Roles

Staff roles live in `user_roles`: **owner** (manager), **practitioner**, **front_desk**. Patients have no staff role and land on `/my-record`. Extra capabilities (reports, team, settings) are granted in Settings → access control.

Two keys are manager-only and are switched by the owner under Team → Staff access: **Edit staff profiles** (`team.manage_profiles`) lets a manager open a colleague's full profile — details, working pattern, bookable treatments, time-off approval — and **Set staff commission** (`team.commission`) adds the commission rate and the colleague's Performance & earnings. Without the first key a manager sees the same Front desk layout of a colleague as everyone else (name, what they can be booked for, hours and unavailability). The owner and the software admin always see the full profile; see `docs/profile-redesign/README.md`.

## Scripts (repo root)

| Script | Purpose |
| --- | --- |
| `scripts/provision-remote.mjs` | Buckets + owner user (needs service role + existing schema) |
| `scripts/ensure-owner.mjs` | Create/update an owner user only |
| `scripts/apply-migrations.mjs` | Apply SQL via `DATABASE_URL` if you are not using the CLI |

## Troubleshooting

**`This page didn't load` on `/`**  
Usually missing `VITE_SUPABASE_*` in `.env`, or `.env` not saved to disk. Restart `npm run dev` after changing env.

**`Could not load your roles: JWT issued at future`**  
This project’s user access tokens are ES256. PostgREST can reject them. Server functions verify the user with Auth, then query with `SUPABASE_SERVICE_ROLE_KEY`. Set that key in `.env` (no `VITE_` prefix) and restart the dev server.

**`function gen_random_bytes(integer) does not exist` on `supabase db push`**  
`pgcrypto` was not enabled. The opening migration now creates it in the `extensions` schema. Re-run `supabase db push`.

**`Could not find the table 'public.clinics'`**  
Migrations have not been applied. Run `supabase db push` against the project ref in `.env`.

**Need the UI without a database**  
`npm run dev:demo`.

## Lovable

This project can sync with [Lovable](https://lovable.dev). Changes pushed to the connected GitHub branch appear in the Lovable editor.

Do **not** force-push, rebase, or squash commits that are already on the remote — that rewrites history on Lovable’s side.

## License

Private. All rights reserved unless otherwise stated.
