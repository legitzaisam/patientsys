# Launch plan build: execution plan (repo copy)

The full plan lives in the Claude doc
[Aetheria — Launch Plan Build: Execution Plan](https://claude.ai/artifact/JXYngkLzSw4BVGtPLQAka9).
The research behind it (ngrok and domains, the pitch, the website design) is in
[Aetheria — Launch Plan](https://claude.ai/artifact/6WbuQuR89LswSeoXkeok8i).
This file is the short version plus what changed while building.

## Rules

- All launch work lives inside `launch-plan/`. Nothing outside it changes.
- Merged into `e2e_live` on 26 Sep 2026 as one local commit, at Karn's request, once his `e2e_live` work was done.
  The `e2e` worktree step in the original plan was skipped: the folder went straight onto `e2e_live`.
- No push from Claude. Karn pushes `e2e_live` himself.
- No secrets in the repo. The ngrok authtoken goes in `launch-plan/.env.local` (git-ignored).
- `~/Downloads/Lovable project` (your `e2e_live` checkout) is never switched, stashed, reset or merged.

## Workstreams and status

| #   | Workstream                                               | Status                                                                                                              |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A   | ngrok + gateway: one public URL for website and demo app | **Ready.** Waiting only for the authtoken and dev domain in `.env.local`. See [`ngrok/README.md`](ngrok/README.md). |
| B   | Marketing website (Astro), stages W0–W6                  | W0–W2 done; hosted preview at https://claude.ai/artifact/HRBrpP8p7Ai1AVkmgaCmkR. W3–W6 next                         |
| C   | Pitch: script, run-sheet, leave-behind, optional slides  | Script, run-sheet and leave-behind done; slides not built                                                           |

### Milestones

| #   | Milestone                                                | Owner                                 | Done when                                |
| --- | -------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| M1  | Worktree, ngrok account, authtoken in `.env.local`       | Karn                                  | `ngrok/doctor.sh` shows no ✗             |
| M2  | Demo app public through gateway + ngrok                  | Claude builds, Karn starts the script | Acceptance checks below pass             |
| M3  | Pitch script, run-sheet, leave-behind                    | Claude                                | Timed rehearsal on the public URL        |
| M4  | Website W0–W2 (foundation, hero, home story)             | Claude                                | Karn approves screenshots                |
| M5  | Website W3–W5 (clinic, patient, Journal, Watch, quality) | Claude                                | Lighthouse ≥ 90, accessibility checklist |
| M6  | Website live at `/` on the ngrok URL                     | Claude, Karn starts the script        | Walkthrough on phone and desktop         |
| M7  | Local commit on `e2e_live`                               | Done 26 Sep, on Karn's go-ahead       | `git log e2e_live` shows it; Karn pushes |

### Acceptance checks for M2

1. `https://<domain>/` shows the website.
2. `/demo/enter?role=owner` lands on the clinic dashboard; practitioner and front desk work too.
3. `/demo/enter?role=patient` lands on the patient portal.
4. A treatment workflow runs end to end through the tunnel.
5. The ngrok dashboard shows traffic within free-plan limits after a rehearsal.
6. `scripts/check-isolation.sh` reports nothing outside `launch-plan/`.

## Changes from the original plan

| Plan said                                                            | Now                                                                          | Why                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token via `ngrok config add-authtoken`                               | `NGROK_AUTHTOKEN` in `launch-plan/.env.local` (the config route still works) | Your request: keep it as an env variable. All ngrok and port settings are env variables, see `.env.example`.                                                                                                                                                                                                              |
| Website preview server on :4321 behind the gateway                   | Gateway serves `website/dist` itself                                         | One process fewer. 4321 is only for `npm run dev` while editing the site.                                                                                                                                                                                                                                                 |
| Production build "if it previews locally", else dev mode + paid plan | **Production build works** and is the default (`APP_MODE=preview`)           | The app's Cloudflare build doesn't preview locally and its server bundle crashes on a circular chunk. `ngrok/vite.demo.config.ts` (inside `launch-plan/`) builds for Node with `strictExecutionOrder`, which fixes it. About 54 requests per cold page load instead of about 430. The free plan is enough for rehearsals. |
| I read the dev domain from your dashboard with browser tools         | You paste it into `.env.local`                                               | It's one copy-paste, and it keeps me out of your signed-in account.                                                                                                                                                                                                                                                       |
| (not planned)                                                        | `ngrok/doctor.sh` pre-flight                                                 | Checks tools, settings, ports and isolation before a run.                                                                                                                                                                                                                                                                 |

## Merge into `e2e_live` (done)

The folder was added to `e2e_live` as a single commit that touches only `launch-plan/`. Two follow-ups are yours to
decide, since they touch files outside the folder: whether to add `launch-plan` to the root ESLint and Prettier
ignore lists (the root `eslint .` and `npm run format` will now see it).

## Guardrails before every hand-off

- [ ] `./launch-plan/scripts/check-isolation.sh` passes
- [ ] Nothing changed in `~/Downloads/Lovable project`
- [ ] No `git push`, no new remote branch
- [ ] No tokens, keys or `.env` values committed inside `launch-plan/`
- [ ] Only demo mode on the public URL; the live Supabase project is never contacted
