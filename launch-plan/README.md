# launch-plan/

Everything for taking Aetheria public lives in this folder: the ngrok setup, the
marketing website and the investor pitch. Nothing here changes the app's source.
The app runs unmodified in demo mode behind a small gateway.

| Folder                      | What it holds                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`ngrok/`](ngrok/README.md) | One-command public URL: `start-public.sh`, `start-demo.sh`, `stop.sh`, `doctor.sh`, config template   |
| [`gateway/`](gateway/)      | Dependency-free Node proxy: website paths → static build, everything else → demo app                  |
| [`website/`](website/)      | Astro marketing site (motion hero, journey story, clinic and patient pages, Journal, Watch)           |
| [`pitch/`](pitch/)          | 2:50 script, demo run-sheet, one-page leave-behind, optional slides                                   |
| [`scripts/`](scripts/)      | `load-env.sh` (shared settings), `check-isolation.sh`                                                 |
| [`docs/`](docs/README.md)   | Exports of the technical documentation, launch plan and execution plan, diagrams, website screenshots |
| [`PLAN.md`](PLAN.md)        | Execution plan, status and merge notes                                                                |

## How the launch works

One command on your Mac serves the website and the demo app from a single public
HTTPS address:

```
website (static build)  ┐
                        ├─> gateway :8099 ──> ngrok ──> https://<your-name>.ngrok-free.dev
demo app :8090          ┘
```

- The **website** is a static Astro build. The gateway serves it at `/`, `/login`
  and the other paths listed in [`gateway/routes.json`](gateway/routes.json).
- The **app** runs in demo mode (`DEMO=1`): fixture clinic, sandboxed email and
  SMS, no live Supabase data and no secrets. Everything the website does not own
  is proxied to it, websockets included.
- **ngrok** tunnels the gateway port to your public URL. Your Mac is the server:
  the site is up while the script is running and the Mac is awake.

Ports 8090 (app) and 8099 (gateway) never collide with your own `npm run dev` on 8080.

## Launching the website, step by step

### 1. Prerequisites

| Need                 | How                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 22 or newer  | The app's `package.json` requires `>=22.12`. If your default `node -v` is 20, use `nvm use 22`, or with Homebrew: `brew install node@22` then `export PATH="$(brew --prefix node@22)/bin:$PATH"` in the terminal you launch from. |
| ngrok agent          | `brew install ngrok`                                                                                                                                                                                                              |
| A free ngrok account | https://dashboard.ngrok.com/signup (no card needed)                                                                                                                                                                               |
| App dependencies     | `npm i` in the repository root (already done if you develop here)                                                                                                                                                                 |

### 2. One-time ngrok setup (about 5 minutes)

1. Copy your **authtoken** from https://dashboard.ngrok.com/get-started/your-authtoken.
2. Claim your **free dev domain** under Universal Gateway → Domains. It looks like
   `something.ngrok-free.dev`; free accounts get one and it stays fixed.
3. Create the settings file and paste both values in:

   ```bash
   cd ~/Downloads/"Lovable project"
   cp launch-plan/.env.example launch-plan/.env.local
   open -e launch-plan/.env.local      # set NGROK_AUTHTOKEN and NGROK_DOMAIN
   ```

   `.env.local` is git-ignored, so the token never enters the repository. Every
   script in this folder reads it; [`.env.example`](.env.example) lists all the
   settings with their defaults.

### 3. Pre-flight

```bash
./launch-plan/ngrok/doctor.sh
```

It checks Node, ngrok, the token and domain, the ports and the app path, and
changes nothing. Fix any ✗ before going on; `!` lines are warnings (for example
"Website not built": the first start builds it).

### 4. Go live

```bash
./launch-plan/ngrok/start-public.sh
```

The script, in order:

1. Builds the website into `website/dist` if it is missing (installs its
   dependencies on the first run).
2. Builds the app in demo mode as a production bundle
   (`APP_MODE=preview`, about 55 requests per page load) and starts it on 8090.
   If that build or its first page fails it falls back to `vite dev` by itself.
3. Starts the gateway on 8099.
4. Opens the ngrok tunnel to `https://$NGROK_DOMAIN` and prints the links:

| Link                                       | Opens                                        |
| ------------------------------------------ | -------------------------------------------- |
| `https://<domain>/`                        | Marketing website                            |
| `https://<domain>/login`                   | Website sign-in page with the persona picker |
| `https://<domain>/demo/enter?role=owner`   | Clinic portal as the clinic owner            |
| `https://<domain>/demo/enter?role=patient` | Patient portal                               |
| `https://<domain>/auth`                    | The app's staff sign-in page                 |
| `http://127.0.0.1:4040`                    | ngrok inspector (every request, local only)  |

`/demo/enter?role=` accepts `owner`, `practitioner`, `front_desk` and `patient`
(`DEMO_DEFAULT_ROLE` is used when the role is missing). The software-admin
persona is not reachable from that URL; the in-app Demo pill still switches to it.

Leave the terminal open. `Ctrl-C` stops the tunnel, the gateway and the app.

### 5. Check it

Open the public URL on a phone and a laptop and walk the acceptance list from
[`PLAN.md`](PLAN.md):

1. `https://<domain>/` shows the website.
2. `/demo/enter?role=owner` lands on the clinic dashboard; practitioner and
   front desk work too.
3. `/demo/enter?role=patient` lands on the patient portal.
4. A treatment workflow runs end to end through the tunnel.
5. The ngrok dashboard shows traffic within free-plan limits after a rehearsal.

On the free plan every visitor sees ngrok's one-time "You are about to visit…"
page first. That is expected; see "Before showing investors" below.

### 6. Stop, restart, rebuild

| Situation                         | Do this                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Finished for the day              | `Ctrl-C` in the script's terminal                                                                      |
| The terminal was closed uncleanly | `./launch-plan/ngrok/stop.sh` (kills ngrok, gateway and app by their pid files)                        |
| You edited the website            | `./launch-plan/ngrok/start-public.sh --rebuild` (the website is only rebuilt when `dist/` is missing)  |
| You edited the app                | `Ctrl-C` and start again; the app is rebuilt on every start                                            |
| You want to preview website edits | `cd launch-plan/website && npm run dev` on http://localhost:4321 (sign-in links need the gateway)      |
| Logs                              | `launch-plan/.run/logs/` — `app.log`, `app-build.log`, `gateway.log`, `ngrok.log`, `website-build.log` |

### 7. Rehearse without ngrok

```bash
./launch-plan/ngrok/start-public.sh --local     # everything except the tunnel, on http://localhost:8099
./launch-plan/ngrok/start-demo.sh               # just the demo app on :8090
```

No account or token is needed for either.

### 8. Optional settings (`launch-plan/.env.local`)

| Variable                          | Default    | What it does                                                                                                     |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `NGROK_AUTHTOKEN`                 | (required) | Read by the ngrok agent from the environment. Nothing is written to disk.                                        |
| `NGROK_DOMAIN`                    | empty      | Your dev domain, without `https://`. Empty lets ngrok choose a temporary URL each run.                           |
| `NGROK_BASIC_AUTH_USER` / `_PASS` | empty      | Password on the whole public URL (ngrok Traffic Policy). Password 8–128 characters. Use it for private previews. |
| `APP_PORT`                        | `8090`     | Demo app port. Change it if `doctor.sh` says 8090 is busy.                                                       |
| `GATEWAY_PORT`                    | `8099`     | The port ngrok forwards to.                                                                                      |
| `APP_MODE`                        | `preview`  | `preview` = production build (about 55 requests per page). `dev` = hot reload (about 430 requests per page).     |
| `APP_DIR`                         | `..`       | Path from `launch-plan/` to the app.                                                                             |
| `DEMO_DEFAULT_ROLE`               | `owner`    | Persona the website's "Explore the demo" button signs in as.                                                     |
| `DEMO_NOW`                        | empty      | Pin the demo clock, e.g. `2026-10-01T09:30:00Z`, for stable screenshots and a predictable diary.                 |

Website-side settings (where the sign-in buttons point, contact email, canonical
URL) live in `website/.env.local`; see [`website/README.md`](website/README.md).

### 9. If something goes wrong

| Symptom                                     | Cause and fix                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor.sh`: "Node v20.x found, 22+ needed" | Switch to Node 22 for this terminal (step 1) and run again.                                                                                                                                     |
| "No ngrok authtoken"                        | `NGROK_AUTHTOKEN` is empty in `.env.local`, or the file was not copied from `.env.example`.                                                                                                     |
| "Port 8090 is busy" / "Port 8099 is busy"   | Something else is listening. `./launch-plan/ngrok/stop.sh` if it is a previous run, otherwise change `APP_PORT` / `GATEWAY_PORT` in `.env.local`.                                               |
| "Build failed … Falling back to dev mode"   | The app still comes up, in dev mode, at about 430 requests per page. Read `.run/logs/app-build.log`; the free plan's 20k requests a month go quickly in dev.                                    |
| "ngrok did not come up"                     | Read `.run/logs/ngrok.log`: usually a wrong domain (must be the one in your dashboard, without `https://`) or a previous ngrok agent still holding that domain (`./launch-plan/ngrok/stop.sh`). |
| Pages load but server calls fail with 403   | The app refuses server-function calls that are not same-origin; the gateway maps the public `Origin` for you. Only happens if the site is embedded in another page or called from another host. |
| Visitors see "You are about to visit…"      | ngrok's free-plan interstitial. Hobbyist ($10/month) removes it.                                                                                                                                |

### Before showing investors

- Upgrade ngrok to **Hobbyist** ($10 a month) to remove the warning page.
- Rehearse with [`pitch/run-sheet.md`](pitch/run-sheet.md) on the public URL
  and check the request count in the ngrok dashboard afterwards. Preview mode
  gives roughly 350 cold page loads a month on the free plan; client-side
  navigation costs far less.
- Optional: set `NGROK_BASIC_AUTH_USER` / `_PASS` for a private preview, and
  `DEMO_NOW` so the diary looks the same in every rehearsal.

### Your own domain later

Buying a `.com` and splitting it into `www.` (website), `clinic.` (staff portal)
and `my.` (patient portal) is covered in [`docs/launch-plan.md`](docs/launch-plan.md),
Part 1b: ngrok Pay-as-you-go or Cloudflare Tunnel from the same Mac, with the
Supabase redirect URLs, `APP_ORIGIN` and webhooks updated for the new hosts. The
gateway already maps the root of `clinic.*` to `/auth` and `my.*` to `/portal`
(`hostRoots` in `routes.json`); the extra ngrok endpoints are sketched in
[`ngrok/ngrok.example.yml`](ngrok/ngrok.example.yml). Either tunnel is a bridge:
before real patient data, move to always-on hosting.

## Rules for this folder

- Lives on `e2e_live` (merged 26 Sep 2026, see `PLAN.md`).
- Launch work stays inside `launch-plan/`; `./launch-plan/scripts/check-isolation.sh` lists any other changed paths.
- Never commit `.env.local` or any token.

## Background

- Research: [Aetheria — Launch Plan](https://claude.ai/artifact/6WbuQuR89LswSeoXkeok8i)
- Plan: [Launch Plan Build: Execution Plan](https://claude.ai/artifact/JXYngkLzSw4BVGtPLQAka9)
- System: [Technical Documentation (HLD & LLD)](https://claude.ai/artifact/AbqJhjfLRX2U76TZxb7vHX)
