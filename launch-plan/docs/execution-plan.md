# Aetheria — Launch Plan Build: Execution Plan

Sep 26, 2026 · Karn Deb

## Summary

All launch-plan work happens in a **second checkout of the `e2e` branch** (a git worktree in a sibling folder), inside one new root folder, `launch-plan/`. Your `e2e_live` checkout, its uncommitted files and every existing source file stay untouched. Nothing is pushed. Commits are local to `e2e`, and only when you say so.

**Current state checked just now:** `e2e_live` is checked out in `~/Downloads/Lovable project` with uncommitted work (responsive report, screenshots, a plan file), one commit ahead of `origin/e2e_live`. `e2e` sits at `94fc1b6`, one commit behind `e2e_live`. Switching branches in your folder would disturb your work, so this plan never switches branches there.

**Deliverables, all under `launch-plan/`:**

| Workstream         | What gets built                                                                                                             | Public result                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A. ngrok + gateway | Start scripts, ngrok config template, a small local gateway that puts the website and the app behind **one** free URL       | `https://<your-dev-domain>.ngrok-free.dev` showing the website, with Clinic and Patient sign-in going into the demo app |
| B. Website         | Astro marketing site per the launch plan: motion hero, journey scroll story, clinic pages, Journal, Watch hub, sign-in page | Served at `/` on the same URL                                                                                           |
| C. Pitch           | 2:50 script, demo run-sheet, one-page investor leave-behind, optional short slides                                          | Files in the folder, plus a rehearsal checklist                                                                         |

**One limit on the ngrok request.** I cannot create accounts or type passwords on your behalf, so you sign up for ngrok yourself (under a minute with "Continue with Google") and add the authtoken on your Mac. Everything after that is mine: finding the dev domain in the dashboard with the browser tools, writing the config and scripts, building the gateway and the site, and checking the public URL end to end.

**What I need from you to start (about 5 minutes, all on your Mac):**

1. Approve this plan.
2. Run the two worktree commands in section 2.2.
3. Create the free ngrok account, then run `brew install ngrok` and `ngrok config add-authtoken <token>`.
4. Tell me when done. I'll take it from there.

## 2. Branch and isolation strategy

A git worktree gives `e2e` its own folder next to yours, sharing the same repository history. You keep working on `e2e_live` in `Lovable project`; I work on `e2e` in `Aetheria-launch`. Neither checkout sees the other's uncommitted files.

### 2.1 Why this is conflict-free

- `e2e` (`94fc1b6`) is already an ancestor of `e2e_live` (`8b977a2`): `e2e_live` contains everything on `e2e` plus one commit.
- The launch work only **adds** files under `launch-plan/`, a path that does not exist on either branch today.
- So when you later merge `e2e` into `e2e_live`, Git brings in only the new folder; no existing file can conflict.

### 2.2 Setup (you run these on your Mac, once)

```bash
cd ~/Downloads/"Lovable project"
git worktree add ../Aetheria-launch e2e
cd ../Aetheria-launch
npm ci        # own node_modules, so the demo app runs without touching yours
```

These need to run on your Mac rather than from my side. Git records absolute paths for worktrees, and my shell sees your folders under different paths, so a worktree I created would break on your machine.

After that I request access to `~/Downloads/Aetheria-launch` (you approve one prompt), and all my file work happens there.

### 2.3 Local-only rules

| Rule                                     | How it is enforced                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No branch switching in `Lovable project` | I never run `checkout`, `switch`, `stash`, `reset` or `merge` there                                                                                                                             |
| All new files under `launch-plan/`       | Every write targets `Aetheria-launch/launch-plan/...`; a final `git status` check must list nothing outside it                                                                                  |
| No push                                  | I never run `git push`; there is no `origin/e2e` branch today and none gets created                                                                                                             |
| Commits only when you say so             | Work stays uncommitted by default. On your go-ahead I commit locally to `e2e` (from my side via `git --git-dir=<repo>/.git/worktrees/Aetheria-launch`, or you run `git commit` in the worktree) |
| No secrets in the repo                   | ngrok authtoken stays in ngrok's own config on your Mac; any local env file sits in `launch-plan/.env.local`, which `launch-plan/.gitignore` excludes                                           |
| No changes to app config                 | The demo app runs unmodified; the ngrok host is allowed through Vite's `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` environment variable instead of editing `vite.config.ts`                        |
| Separate ports                           | Demo app on **8090**, website preview on **4321**, gateway on **8099**, so nothing collides with your `npm run dev` on 8080                                                                     |

## 3. Folder structure

Everything lives in one self-contained folder with its own `package.json` files and `.gitignore`. It imports nothing from `src/`; it only reads the app's design tokens by copying `src/styles.css` values into the website's own stylesheet.

```text
launch-plan/
├─ README.md                 # what this folder is, how to run everything, merge notes
├─ PLAN.md                   # this execution plan, kept in the repo
├─ .gitignore                # node_modules, dist, .astro, .env.local, logs
├─ docs/                     # launch-plan research, exported from the Claude doc
│  └─ launch-plan.md
├─ ngrok/
│  ├─ README.md               # account steps, dev domain, troubleshooting
│  ├─ ngrok.example.yml       # v3 config template (no token)
│  ├─ start-demo.sh           # demo app on :8090 with the ngrok host allowed
│  ├─ start-public.sh         # demo app + website + gateway + ngrok, one command
│  └─ stop.sh
├─ gateway/
│  ├─ package.json            # tiny Node reverse proxy (http + websockets)
│  ├─ server.mjs              # routes website paths to :4321, everything else to :8090
│  └─ routes.json             # the path table, editable without code changes
├─ website/
│  ├─ package.json            # Astro + React islands + GSAP + Motion + Lenis + R3F
│  ├─ astro.config.mjs
│  ├─ public/                 # fonts, posters, fallback videos, OG images
│  └─ src/
│     ├─ styles/tokens.css    # copied Aetheria tokens + skin-light ramp + motion tokens
│     ├─ layouts/  pages/  components/  islands/  motion/
│     └─ content/             # journal/*.mdx, videos/*.json, creators, reviewers
├─ pitch/
│  ├─ script.md               # 2:50 script with timings and alternative closes
│  ├─ run-sheet.md            # tabs to pre-open, click path, fallbacks if Wi-Fi drops
│  ├─ leave-behind.md         # one-page investor summary (exports to PDF)
│  └─ slides/                 # optional 6-slide HTML deck for the close
└─ scripts/
   └─ check-isolation.sh      # fails if any change exists outside launch-plan/
```

## 4. Workstream A — ngrok and the local gateway

The free plan gives exactly one dev domain, so a small gateway on port 8099 sits in front of both the website and the demo app. ngrok exposes only the gateway: the website answers `/` and its own pages, and everything else goes to the app.

### 4.1 Who does what

| Step                        | Who                        | Detail                                                                                                                                        |
| --------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Create the ngrok account | **You**                    | ngrok.com → Sign up → Continue with Google (company account). I'm not able to create accounts or enter passwords for you                      |
| 2. Install and authenticate | **You**, on the Mac        | `brew install ngrok`, then `ngrok config add-authtoken <token from dashboard>`; the token stays in ngrok's own config file, never in the repo |
| 3. Find the dev domain      | Me, with the browser tools | Read **Universal Gateway → Domains** in your signed-in dashboard and record the `*.ngrok-free.dev` name in `launch-plan/ngrok/README.md`      |
| 4. Write config and scripts | Me                         | `ngrok.example.yml`, `start-demo.sh`, `start-public.sh`, `stop.sh`                                                                            |
| 5. Build the gateway        | Me                         | `launch-plan/gateway/` (section 4.2)                                                                                                          |
| 6. First public run         | You start it; I verify     | `./launch-plan/ngrok/start-public.sh` in a Mac terminal; I test the public URL from the browser tools                                         |

The app and ngrok have to run in a terminal on your Mac. The shell I use on your machine is a Linux sandbox that cannot run your macOS `node_modules` or keep a tunnel alive, so I write one-command scripts and you start them.

### 4.2 Gateway routing

| Path                                                                                                                                                                        | Goes to                         | Why                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (exact), `/for-patients*`, `/for-clinics*`, `/pricing`, `/compliance*`, `/journal*`, `/watch*`, `/about`, `/login`, `/legal/*`, `/_astro/*`, `/media/*`, `/favicon.svg` | Website (static build on :4321) | Marketing pages; the website avoids `/patients`, which the app uses                                                                                 |
| `/demo/enter?role=owner\|practitioner\|front_desk\|patient`                                                                                                                 | Gateway itself                  | Sets the app's `demo_role` cookie and redirects to `/dashboard` or `/my-record`, so the website's sign-in buttons land straight in the right portal |
| Everything else (`/auth`, `/portal`, `/dashboard`, `/my-record/*`, `/api/*`, assets, websockets)                                                                            | Demo app on :8090               | The app runs unmodified                                                                                                                             |

The website's **Sign in** page offers "Clinic team" (owner, practitioner or receptionist view) and "Patient" (Olivia's portal), each pointing at `/demo/enter`.

### 4.3 Running the demo app safely and cheaply

- **Demo mode only** (`DEMO=1`): fixture clinic, sandboxed comms, no live Supabase. The start script passes placeholder `VITE_SUPABASE_*` values, so the worktree needs no copy of your `.env` and no secret leaves your machine.
- **Allowed host** via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.ngrok-free.dev`, with no edit to `vite.config.ts`.
- **Request budget.** Vite dev mode serves hundreds of module requests per page load, which would use up the free plan's 20,000 requests a month within a few dozen visits. Step one of this workstream is a short test of a production build in demo mode (`DEMO=1 vite build` + preview). If the Cloudflare-targeted build won't preview locally, the fallback is dev mode plus the $10 Hobbyist plan (100k requests), your decision at that point.
- **Warning page.** On the free plan, first-time visitors see ngrok's interstitial once; Hobbyist removes it.

### 4.4 Acceptance checks

1. `https://<dev-domain>.ngrok-free.dev/` shows the website hero with no console errors.
2. Sign in → Clinic team → owner lands on the demo dashboard; practitioner and receptionist variants work.
3. Sign in → Patient lands on Olivia's portal home; the chat and AI bubbles respond.
4. A treatment workflow runs end to end through the tunnel (arrival → consent → form → complete).
5. `ngrok` dashboard shows traffic within free-plan limits after a full rehearsal.
6. `launch-plan/scripts/check-isolation.sh` reports no changes outside `launch-plan/`.

## 5. Workstream B — Marketing website

The site is built in `launch-plan/website/` as an Astro app with React islands, following the launch plan's design (hero concept B, "light through skin"). It is built in seven checkpoints, and each one ends with screenshots at desktop and phone width for your review.

| Stage                        | Scope                                                                                                                                                                                                                                            | Review artefact                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| W0. Foundation               | Astro scaffold, copied Aetheria tokens + skin-light ramp + motion tokens, fonts, layout, top bar with **Sign in ▾** and **Book a demo**, footer, `/login` split page wired to `/demo/enter`                                                      | Screenshots of shell and sign-in page        |
| W1. Hero                     | Loader (droplet → Æ), serum-drop hero in React Three Fiber with the refracted headline, two glowing doors; SVG "journey thread" fallback for reduced motion and low-power devices                                                                | Short screen recording + fallback screenshot |
| W2. Home story               | Pinned journey scroll story (six chapters using real portal screenshots from `docs/`), two-doors split, clinic OS bento with live mini-UIs, consent-lock moment, before/after slider (skin-quality treatments only), voices marquee, closing CTA | Full-page recording, desktop and phone       |
| W3. Clinic pages             | Product overview + seven module pages, pricing (placeholder numbers), compliance and licensing readiness, trust centre                                                                                                                           | Page screenshots                             |
| W4. Patients, Journal, Watch | For-patients pages, Journal with MDX collections and six seed articles marked **"AI draft — awaiting clinical review"**, Watch hub with the 9:16 rail, theatre mode, captions and "Ad" labels                                                    | Journal and Watch recordings                 |
| W5. Quality pass             | Legal pages, designed 404, SEO and structured data, Open Graph images, reduced-motion mode, keyboard and contrast checks, Lighthouse ≥ 90                                                                                                        | Lighthouse report + accessibility checklist  |
| W6. Go public                | Static build served through the gateway on the ngrok URL                                                                                                                                                                                         | Public URL walkthrough                       |

**How it gets built and checked.** I write the files into the worktree, then build and screenshot them with Playwright in my cloud workspace (Chromium is available there), fixing issues before you see them. For the public run, `start-public.sh` installs and builds the website on your Mac.

**Content and media.**

- Imagery starts with code-drawn visuals (shaders, SVG, gradients) and the app's own screenshots.
- Stock or model photography needs licensed assets from you. Seed articles cite their sources and stay labelled as drafts until a named clinician signs them off.
- Videos: you drop a file in `website/public/media/` and add a JSON entry (title, creator, relationship, captions). Hosting on Mux or Cloudflare Stream comes later.
- CMS (Sanity or Payload) is deferred; file-based content first keeps the folder self-contained.

**Compliance built in:** no prescription-only medicine names or toxin before/after images on patient pages, creator content labelled "Ad" where paid or gifted, no filtered results imagery, cookieless analytics only.

## 6. Workstream C — Pitch materials

The pitch lands in `launch-plan/pitch/` as plain Markdown, so it versions with the rest of the folder and exports to PDF when needed.

| File                 | Contents                                                                                                                                                                                                                             | Depends on                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `script.md`          | The 2:50 script from the launch plan with timings, on-screen cues and three alternative closes (clinics, practitioners, patients)                                                                                                    | Your raise amount and pilot numbers             |
| `run-sheet.md`       | Four tabs to pre-open on the public URL (diary, patient record with the treatment form, patient portal, retention), exact click path per beat, fallbacks if the network or tunnel drops (local `localhost:8099` copy, recorded film) | Workstream A live                               |
| `leave-behind.md`    | One-page investor summary: problem, product, differentiation table, market, team, ask                                                                                                                                                | Market figures verified against primary sources |
| `slides/` (optional) | Six HTML slides for the close (market, why now, differentiation, traction, roadmap, ask), in the website's visual style                                                                                                              | Workstream B tokens                             |
| `film/` notes        | Shot list for a 2:50 screen recording of the demo, used on the website's investors page and Watch hub                                                                                                                                | Workstreams A and B                             |

Rehearsal gate: one full timed run through the public ngrok URL with every cue working, before the first external meeting.

## 7. Milestones, merge and guardrails

### 7.1 Milestones

| #   | Milestone                                                     | Owner                     | Target        | Done when                                              |
| --- | ------------------------------------------------------------- | ------------------------- | ------------- | ------------------------------------------------------ |
| M1  | Worktree, `npm ci`, ngrok account and authtoken               | You                       | Day 1         | Section 2.2 commands run; folder access approved       |
| M2  | Demo app public through gateway + ngrok                       | Me (you start the script) | Day 1–2       | Acceptance checks 1–5 in section 4.4 pass              |
| M3  | Pitch script, run-sheet, leave-behind                         | Me                        | Day 2–3       | Timed rehearsal on the public URL                      |
| M4  | Website W0–W2 (foundation, hero, home story)                  | Me                        | Week 1        | You approve the recordings                             |
| M5  | Website W3–W5 (clinic, patient, Journal, Watch, quality pass) | Me                        | Week 2        | Lighthouse ≥ 90, accessibility checklist passes        |
| M6  | Website live at `/` on the ngrok URL, app behind sign-in      | Me (you start the script) | End of week 2 | Full walkthrough on phone and desktop                  |
| M7  | Local commit on `e2e`                                         | Me, on your go-ahead      | When you say  | `git log e2e` shows the launch commits; nothing pushed |

### 7.2 Merging into `e2e_live` later (you decide when)

Because `e2e` is an ancestor of `e2e_live` and only adds `launch-plan/`, either route is clean:

```bash
cd ~/Downloads/"Lovable project"          # on e2e_live, your own work committed first
git merge --no-ff e2e -m "Merge launch-plan from e2e"
# or copy just the folder:
git checkout e2e -- launch-plan && git commit -m "Add launch-plan"
# afterwards, remove the second checkout
git worktree remove ../Aetheria-launch
```

Two small follow-ups to decide at merge time, since they touch files outside the folder: the root `eslint .` will also lint `launch-plan/**/*.ts(x)` (non-blocking in CI today; add `launch-plan` to the root ignore list if you prefer), and `npm run format` will format the folder too.

### 7.3 Guardrails checklist (run before every hand-off)

- [ ] `git -C Aetheria-launch status --porcelain` lists only `launch-plan/` paths
- [ ] Nothing changed in `~/Downloads/Lovable project` (your `git status` is exactly as you left it)
- [ ] No `git push`, no new remote branch
- [ ] No tokens, keys or `.env` values inside `launch-plan/`
- [ ] Demo mode only on the public URL; the live Supabase project is never contacted by the tunnelled app
- [ ] Stray probe file `.tmp-counts.mjs` in `Lovable project` is yours to delete (I can't delete files there)
