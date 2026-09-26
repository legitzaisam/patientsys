# Putting Aetheria online with ngrok

One command puts the marketing website and the Aetheria demo on a single public
HTTPS address, served from your Mac:

```
website (static build)  ┐
                        ├─> gateway :8099 ──> ngrok ──> https://<your-name>.ngrok-free.dev
demo app :8090          ┘
```

The app runs in **demo mode** (`DEMO=1`): fixture clinic, sandboxed email and SMS,
no live Supabase data and no secrets needed. Your own `npm run dev` on 8080 is
never touched.

## What you do once (about 5 minutes)

1. **Create the ngrok account** at https://dashboard.ngrok.com/signup (free, no card).
2. **Install the agent:** `brew install ngrok`
3. **Copy your authtoken** from https://dashboard.ngrok.com/get-started/your-authtoken
4. **Claim your free dev domain** under Universal Gateway → Domains
   (it looks like `something.ngrok-free.dev`; free accounts get one).
5. Create the settings file and paste both values in:

   ```bash
   cd ~/Downloads/"Lovable project"
   cp launch-plan/.env.example launch-plan/.env.local
   open -e launch-plan/.env.local      # set NGROK_AUTHTOKEN and NGROK_DOMAIN
   ```

   `.env.local` is git-ignored, so the token never enters the repository.

## Every time

```bash
./launch-plan/ngrok/doctor.sh          # optional pre-flight, changes nothing
./launch-plan/ngrok/start-public.sh    # builds what is missing, then goes live
```

It prints the links:

| Link                                       | Opens                                       |
| ------------------------------------------ | ------------------------------------------- |
| `https://<domain>/`                        | Marketing website                           |
| `https://<domain>/demo/enter?role=owner`   | Clinic portal as the clinic owner           |
| `https://<domain>/demo/enter?role=patient` | Patient portal                              |
| `https://<domain>/auth`                    | Staff sign-in page                          |
| `http://127.0.0.1:4040`                    | ngrok inspector (every request, local only) |

`Ctrl-C` stops everything. If a run was killed uncleanly: `./launch-plan/ngrok/stop.sh`.

Other options:

```bash
./launch-plan/ngrok/start-public.sh --local     # everything except ngrok, on http://localhost:8099
./launch-plan/ngrok/start-public.sh --rebuild   # rebuild the website first
./launch-plan/ngrok/start-demo.sh               # just the demo app on :8090
```

Demo personas for `/demo/enter?role=`: `owner`, `practitioner`, `front_desk`, `patient`.

## Settings (`launch-plan/.env.local`)

| Variable                          | Default    | What it does                                                                                                 |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `NGROK_AUTHTOKEN`                 | (required) | Read by the ngrok agent from the environment. Nothing is written to disk.                                    |
| `NGROK_DOMAIN`                    | empty      | Your dev domain, without `https://`. Empty lets ngrok choose.                                                |
| `NGROK_BASIC_AUTH_USER` / `_PASS` | empty      | Optional password on the whole URL (ngrok Traffic Policy). Password 8–128 characters.                        |
| `APP_PORT`                        | `8090`     | Demo app port.                                                                                               |
| `GATEWAY_PORT`                    | `8099`     | The port ngrok forwards to.                                                                                  |
| `APP_MODE`                        | `preview`  | `preview` = production build (about 55 requests per page). `dev` = hot reload (about 430 requests per page). |
| `APP_DIR`                         | `..`       | Path from `launch-plan/` to the app.                                                                         |
| `DEMO_DEFAULT_ROLE`               | `owner`    | Persona used when `/demo/enter` has no `role`.                                                               |
| `DEMO_NOW`                        | empty      | Pin the demo clock, e.g. `2026-10-01T09:30:00Z`, for stable screenshots.                                     |

## How it works

- **`start-demo.sh`** runs the app with `DEMO=1` and `APP_ORIGIN` set to the public
  URL. It allows ngrok hosts through Vite's `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`
  variable instead of editing `vite.config.ts`. With no `.env` in the repo it passes
  placeholder Supabase values, which demo mode never calls.
- **Preview mode** builds with `NITRO_PRESET=node-server` and
  [`vite.demo.config.ts`](vite.demo.config.ts), which loads the app's config
  unchanged and adds `strictExecutionOrder`. Without it the server bundle has a
  circular chunk and crashes with `createCsrfMiddleware is not a function`. The
  app's own Cloudflare build is not affected. If the build or its first page
  fails, the script falls back to dev mode by itself.
- **`gateway/server.mjs`** (no dependencies) serves the website's paths from
  `website/dist` and proxies everything else, websockets included, to the app.
  It keeps the `Host` header and adds `X-Forwarded-*`, and sets the demo persona
  cookie on `/demo/enter`. The path split lives in `gateway/routes.json`.
- **CSRF:** the app only accepts server-function calls from its own origin.
  Modern browsers send `Sec-Fetch-Site: same-origin`, which passes. For older
  browsers that send only `Origin: https://<domain>`, the gateway maps that one
  same-host value to `http://` to match what the app sees. Cross-site calls
  are still refused (tested: 403).

## Verified on the e2e branch

| Check                                                                        | Result                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| Gateway unit tests (`cd launch-plan/gateway && npm test`)                    | 8/8 pass                                       |
| `/auth`, `/dashboard`, `/my-record` through the gateway with an ngrok `Host` | 200 (dev and preview)                          |
| `/demo/enter?role=owner` / `patient`                                         | 302 to `/dashboard` / `/my-record`, cookie set |
| Server function, same-origin                                                 | 200 with data                                  |
| Server function, cross-site                                                  | 403                                            |
| Unknown host straight to Vite                                                | 403 (host check still on)                      |
| Requests per cold page load                                                  | ~430 dev, ~54 preview                          |

Not testable here without your account: the ngrok tunnel itself. `doctor.sh` and
the first `start-public.sh` run cover that.

## Free plan limits to keep in mind

- 1 GB transfer and 20,000 HTTP requests a month. Preview mode makes that roughly
  350 full cold page loads; client-side navigation costs far less.
- Visitors see ngrok's one-time "You are about to visit…" page on the free plan.
  A paid plan removes it.
- The tunnel runs only while your Mac is awake and the script is running.

## Your own domain later

Launch plan Part 1b covers buying a domain and attaching `www.`, `clinic.` and `my.`
on a paid plan. The gateway already handles it: the root of `clinic.*` opens
`/auth` and the root of `my.*` opens `/portal` (`hostRoots` in `routes.json`). The
extra endpoints are sketched in [`ngrok.example.yml`](ngrok.example.yml).
