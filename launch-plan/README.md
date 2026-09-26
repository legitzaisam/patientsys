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

## Quick start

```bash
cd ~/Downloads/"Lovable project"
cp launch-plan/.env.example launch-plan/.env.local
# paste NGROK_AUTHTOKEN and NGROK_DOMAIN into .env.local
./launch-plan/ngrok/doctor.sh
./launch-plan/ngrok/start-public.sh
```

No account yet? `./launch-plan/ngrok/start-public.sh --local` runs everything on
http://localhost:8099.

## Settings

Every setting is an environment variable in `launch-plan/.env.local`, which is
git-ignored. [`.env.example`](.env.example) lists them all with defaults. Ports
8090 (app) and 8099 (gateway) never collide with your own `npm run dev` on 8080.

## Rules for this folder

- Lives on `e2e_live` (merged 26 Sep 2026, see `PLAN.md`).
- Launch work stays inside `launch-plan/`; `./launch-plan/scripts/check-isolation.sh` lists any other changed paths.
- Never commit `.env.local` or any token.

## Background

- Research: [Aetheria — Launch Plan](https://claude.ai/artifact/6WbuQuR89LswSeoXkeok8i)
- Plan: [Launch Plan Build: Execution Plan](https://claude.ai/artifact/JXYngkLzSw4BVGtPLQAka9)
- System: [Technical Documentation (HLD & LLD)](https://claude.ai/artifact/AbqJhjfLRX2U76TZxb7vHX)
