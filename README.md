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
2. **A URL**, when the app runs behind `launch-plan/gateway`: `/demo/enter?role=owner|practitioner|front_desk|patient` (the gateway does not route `manager` or `admin`; use the pill for those).
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
