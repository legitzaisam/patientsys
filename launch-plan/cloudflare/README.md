# launch-plan/cloudflare/ — SQINOS on www.sqinos.com from this Mac

Serves the marketing website, the clinic portal and the patient portal on
**https://www.sqinos.com** through a free Cloudflare Tunnel. Nothing listens on
the internet: `cloudflared` opens one outbound connection to Cloudflare, which
terminates TLS and forwards every request to the launch gateway on port 8099.

```
website snapshot  (launch-plan/.run/website-live)  ┐
                                                   ├─> gateway :8099 ──> cloudflared ──> https://www.sqinos.com
demo app snapshot (launch-plan/.run/app-live) :8090┘                       sqinos.com ──301──> www (Cloudflare rule)
```

The app runs in demo mode (fixture clinic, no Supabase). The website and the app
are served from **snapshots** under `launch-plan/.run/`, so a rebuild never
touches what visitors see; `redeploy.sh` swaps the snapshot when the build is done.

| Script | What it does |
| --- | --- |
| `setup-tunnel.sh` | One-time: `cloudflared tunnel login` (browser), create tunnel `sqinos`, write `~/.cloudflared/sqinos.yml`, validate, create the two proxied CNAMEs. Safe to rerun |
| `doctor.sh` | Pre-flight, changes nothing: Node 22, cloudflared, settings, tunnel credentials, DNS, ports, builds, QC |
| `start-public.sh [--rebuild] [--local]` | Builds the website (first run or `--rebuild`), builds the demo app, starts app + gateway + tunnel, prints the links. Ctrl-C stops all |
| `redeploy.sh website \| app \| all \| tunnel` | Push an edit to the running site (see below); `tunnel` restarts only cloudflared |
| `status.sh` | Which processes run, and whether local and public health checks answer |
| `stop.sh` | Stops tunnel, gateway and app by pid file |
| `lib.sh` | Shared functions (sourced by the others) |
| `config.example.yml` | Only for a locally-managed tunnel; not needed with a token |

Settings live in `launch-plan/.env.local` (git-ignored): `PUBLIC_DOMAIN`,
`TUNNEL_TOKEN` (or `TUNNEL_NAME` + `CLOUDFLARED_CONFIG`), ports, demo
options, and the `VITE_SUPABASE_*` placeholders that keep the live Supabase
keys out of the public bundle. Website-side settings (canonical URL, contact
address) live in `website/.env.local`.

## First launch

```sh
cd ~/Downloads/"Lovable project"
brew install cloudflared tmux            # once
./launch-plan/cloudflare/setup-tunnel.sh # once: browser login, creates tunnel "sqinos", writes ~/.cloudflared/sqinos.yml, routes DNS
./launch-plan/cloudflare/doctor.sh       # every line ✓ (warnings ok)
./launch-plan/qc/run.sh --rebuild        # optional but recommended: stitching QC, ~3 min
tmux new -s sqinos                       # a terminal that survives closing the window
caffeinate -dims ./launch-plan/cloudflare/start-public.sh
```

Detach from tmux with `Ctrl-b d`, come back with `tmux attach -t sqinos`.
`caffeinate -dims` keeps the Mac awake while the script runs (also turn on
"Prevent automatic sleeping when the display is off" in System Settings →
Battery, on power adapter).

## After you edit something

| You changed | Run | Effect |
| --- | --- | --- |
| The website (`launch-plan/website/src/**`, `public/**`, `website/.env.local`) | `./launch-plan/cloudflare/redeploy.sh website` | Rebuilds Astro (~5 s) and swaps the snapshot. No restart, no downtime |
| The app: clinic portal or patient portal (`src/**`, `supabase/**` fixtures, `launch-plan/.env.local` demo options) | `./launch-plan/cloudflare/redeploy.sh app` | Rebuilds the demo bundle (~1–2 min, old app keeps serving), then restarts it (~3 s of "not reachable"). Demo data resets |
| Both, or not sure | `./launch-plan/cloudflare/redeploy.sh all` | Website first, then the app |
| The gateway (`launch-plan/gateway/*`) | `./launch-plan/cloudflare/stop.sh` then start again | The gateway is not snapshotted; `node launch-plan/gateway/test.mjs` first |
| Nothing, but the site is unreachable after a VPN/Wi-Fi change | `./launch-plan/cloudflare/redeploy.sh tunnel` | Restarts only cloudflared; the supervisor in `start-public.sh` also restarts any component that dies |

Run them from the repo root in any terminal (not necessarily the tmux one).
Cloudflare needs no cache purge: asset file names are content-hashed and HTML is
not cached at the edge.

## Everyday

| Situation | Do this |
| --- | --- |
| Is it up? | `./launch-plan/cloudflare/status.sh` or `curl -sI https://www.sqinos.com/healthz` |
| Reset the demo data | `./launch-plan/cloudflare/redeploy.sh app` (or stop/start) |
| Terminal closed uncleanly | `./launch-plan/cloudflare/stop.sh`, then start again |
| Mac rebooted | `tmux new -s sqinos` and the start command again |
| Take it offline | Ctrl-C in the tmux window, or `stop.sh`; visitors then see Cloudflare's 530 page |
| Logs | `launch-plan/.run/logs/{app,app-build,gateway,cloudflared,website-build}.log` |

## If something is off

| Symptom | Cause / fix |
| --- | --- |
| `doctor.sh`: Node 20 found | `brew install node@22`; the scripts pick up `/opt/homebrew/opt/node@22/bin` by themselves |
| `No TUNNEL_TOKEN and no tunnel config` | Paste the tunnel token from Cloudflare → Zero Trust → Networks → Tunnels → sqinos → Configure into `TUNNEL_TOKEN=` in `.env.local` |
| Start says the tunnel is up but `/healthz` does not answer | The zone is not Active yet (nameservers still propagating) or the tunnel has no public hostname for `www.sqinos.com`; read `.run/logs/cloudflared.log` |
| Cloudflare page **Error 530 / 1033** | cloudflared is not running or cannot reach Cloudflare. `cloudflared.log` full of `Failed to dial a quic connection` = UDP is blocked (VPN such as Tailscale, hotel Wi-Fi): the scripts already use `TUNNEL_PROTOCOL=http2` (TCP); `redeploy.sh tunnel` reconnects |
| Gateway page "The demo app is not reachable" | The app on 8090 died: `.run/logs/app.log` |
| `503 The website is not built yet` | No website snapshot: `redeploy.sh website` |
| `The live Supabase project ref is in the built bundle` | The `VITE_SUPABASE_*` placeholders are missing from `.env.local` |
| Pages load but every action fails (403) | The app refuses server-function calls that are not same-origin; Cloudflare sends `X-Forwarded-Proto: https` and the gateway maps the origin. Check nothing strips that header (no Transform Rule on the zone) |

## The other way: a locally-managed tunnel

Without a dashboard token: `cloudflared tunnel login`, `cloudflared tunnel create sqinos`,
copy `config.example.yml` to `~/.cloudflared/sqinos.yml` and fill in the UUID,
`cloudflared tunnel route dns sqinos www.sqinos.com` (and `sqinos.com`), leave
`TUNNEL_TOKEN` empty. `start-public.sh` then runs `cloudflared tunnel --config … run sqinos`.

## Rules

- Everything here stays inside `launch-plan/`; the app, gateway and website are unchanged.
- Never commit `.env.local`, a tunnel token or `~/.cloudflared/*`.
- Demo mode only behind the public domain: live mode needs the safety work in the technical documentation §13.
