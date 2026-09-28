# e2e_live pull, 28 September 2026

Everything that arrived on `e2e_live` between our last push (`e956bfd`) and the remote head (`21dee87`): what each commit does, and how the app looked before and after it.

## What was pulled

- **19 commits**, a clean fast-forward. `package.json` and the lockfile did not change, so the old and new checkouts share one `node_modules`.
- **15 app commits**, documented one page each (table below). Every commit is compared with its own parent, so a page touched by several commits shows one step at a time.
- **4 commits without app changes**, not documented further:
  - `95cc4eb`: Only adds static mock-up HTML files under `Claude outputs/` and `public/ipad-qc.html`; nothing in the app changes.
  - `bc02152`: Merge of our pushed `e2e_live` into Zaisam's line; no new content.
  - `cc21081`: Merge; only `zaisam.txt`.
  - `d5a5789`: Merge; only `zaisam.txt`. This is the base state every commit below is compared against.

## Signing in to the before and after apps

While this set was being made the old app ran on port 8095 (`e956bfd`) and the new one on port 8096 (`21dee87`): [old clinic portal](http://127.0.0.1:8095/dashboard), [new clinic portal](http://127.0.0.1:8096/dashboard), [old patient portal](http://127.0.0.1:8095/my-record), [new patient portal](http://127.0.0.1:8096/my-record). Go straight to `/dashboard` or `/my-record`: the root `/` is the app's public landing page with a Staff sign in button, and it looks the same in demo and live mode. Both servers are demo mode (`DEMO=1`, fixture data, the clock pinned to 2026-09-28T09:30:00Z), so **no password is checked**: the server trusts a `demo_role` cookie. Switch role with the **Demo pill** at the bottom-left of any page, or, behind the launch gateway, open `/demo/enter?role=owner|practitioner|front_desk|patient`. Signing in at `/auth` with one of the emails maps it onto the persona, but that needs a real Supabase project where the account exists; the passwords are the ones `scripts/provision-staff.mjs` creates. The same table lives in the repo [README](../../../README.md#demo-accounts-and-roles).

| Role (`demo_role`) | Persona you become | Sign-in email | Password | Lands on |
| ------------------ | ------------------ | ------------- | -------- | -------- |
| `owner` (clinic owner) | Dr Amara Osei, Clinic Director | `amara.osei@aetheria.clinic` | Set by `OWNER_PASSWORD` when the owner was provisioned; not in the repo | `/dashboard` |
| `manager` | Maya Chen, Clinic manager | `maya.chen@aetheria.clinic` | Pill only (no account provisioned) | `/dashboard` |
| `practitioner` | Dr Nadia Rahman, Aesthetic Practitioner | `nadia.rahman@aetheria.clinic` | `Practitioner1!` | `/dashboard` |
| `practitioner` | Dr Tom Whitfield, Aesthetic Doctor | `tom.whitfield@aetheria.clinic` | `Practitioner2!` | `/dashboard` |
| `front_desk` (receptionist) | Sofia Marchetti, Patient Coordinator | `sofia.marchetti@aetheria.clinic` | `Reception1!` | `/dashboard` |
| `patient` | Olivia Bennett | `olivia.bennett@example.com` | Pill only (no account provisioned); `/portal` if one is created | `/my-record` |
| `admin` (software admin) | Software developer | `developer@aetheria.clinic` | `Developer1!` | `/access` |

The **live** project has a different roster (Zaisam Al-Dulimi as owner, a test manager, the three scripted staff, a software admin and one patient); it is listed under [Live accounts and roles](../../../README.md#live-accounts-and-roles) in the repo README.

## Database migrations that arrived

Demo mode runs on fixtures, so none of these were applied here. They matter for the live Supabase project.

| Migration | Commit | What it does |
| --------- | ------ | ------------ |
| `20260930000200_profile_governance.sql` | `a9913cc` | `profiles.working_arrangement`; `profile_change_requests` gains `registration_expiry`, `work_email`, `working_arrangement`, `requires_owner`. |
| `20260930000300_clinic_setup_roles.sql` | `3b3d678` | `clinics.has_separate_manager`, `clinics.owner_setup_at`; new tables `clinic_roles` and `clinic_role_permissions` with RLS; `profiles.clinic_role_id`. |
| `20260930000400_manager_approve_changes_opt_in.sql` | `d15817d` | Turns `team.approve_changes` off for managers where the owner never touched it. |
| `20260930000500_profile_change_inbox_cleared.sql` | `20a1e58` | `profile_change_requests.inbox_cleared_at`, so a reviewed request can leave the Team inbox without being deleted. |
| `20260930000600_staff_notifications_reply_to.sql` | `971c04c` | `staff_notifications.reply_to_id` plus an index, so a reply points at the alert it answers. |

## The commits

| # | Commit | Change | Scenes |
| - | ------ | ------ | -----: |
| 01 | [`a9913cc`](https://github.com/legitzaisam/patientsys/commit/a9913cc2ca11bd3a3e1f2e9fcffcd027bc614d88) | [My profile becomes the home for earnings and performance; phone numbers are validated](commits/01-a9913cc.md) | 14 |
| 02 | [`3b3d678`](https://github.com/legitzaisam/patientsys/commit/3b3d678923e8f7a0342656f1871e8ad68e31d315) | [Named clinic roles, an owner set-up question, and a rebuilt Invite staff dialog](commits/02-3b3d678.md) | 4 |
| 03 | [`d15817d`](https://github.com/legitzaisam/patientsys/commit/d15817dcdf2e2d6ed8b5e5ad2342502595598f99) | [Profile change approvals can be handed to managers; Staff access gets groups and a change log](commits/03-d15817d.md) | 3 |
| 04 | [`20a1e58`](https://github.com/legitzaisam/patientsys/commit/20a1e582bf63ec7a93941aa0adf5965a98bd23cd) | [Staff access grid: icons, counts, pinned header and animated groups; reviewed requests can be cleared](commits/04-20a1e58.md) | 2 |
| 05 | [`142563a`](https://github.com/legitzaisam/patientsys/commit/142563a64ec3926afa67080b50579d67168d5c96) | [Access history dialog; the staff bell shows new bookings only](commits/05-142563a.md) | 4 |
| 06 | [`46dff1a`](https://github.com/legitzaisam/patientsys/commit/46dff1a54806d1be9a4cf8c4b8e55d7458abce5c) | [Team chat in the floating dock](commits/06-46dff1a.md) | 5 |
| 07 | [`d625c36`](https://github.com/legitzaisam/patientsys/commit/d625c368cf2cb6ebcb6bc62819d017f8e9df0cad) | [Practitioner card from the sidebar: availability, urgent notes, message; alerts can be acknowledged or dismissed](commits/07-d625c36.md) | 6 |
| 08 | [`765c1cc`](https://github.com/legitzaisam/patientsys/commit/765c1cc0f48ed58efecf5ee2a5a4500529b8cf67) | [Online colleagues first; day-card alerts open in the chat, ready to act on](commits/08-765c1cc.md) | 3 |
| 09 | [`a4c6f6d`](https://github.com/legitzaisam/patientsys/commit/a4c6f6d8e94aad41732b2df23ec6f4a5b41573df) | [Diary and chat clean-up: My appointments, a lighter quick-reply toast, simpler persona switching](commits/09-a4c6f6d.md) | 4 |
| 10 | [`971c04c`](https://github.com/legitzaisam/patientsys/commit/971c04ccf5f2062534b3363a7a880216a1c7cd97) | [Reply to a team alert; one source of copy for the plan's next step](commits/10-971c04c.md) | 6 |
| 11 | [`8a89a91`](https://github.com/legitzaisam/patientsys/commit/8a89a911387af36a38ee500033659cef1abedc6c) | [Overdue steps say how late they are](commits/11-8a89a91.md) | 3 |
| 12 | [`789f666`](https://github.com/legitzaisam/patientsys/commit/789f666d48e66f78c3d5ff94b8e0a1de874bcfd0) | [Treatment due means the board's Book chase, for every role](commits/12-789f666.md) | 8 |
| 13 | [`9202460`](https://github.com/legitzaisam/patientsys/commit/920246055f6cd6307dd8e9e2a2fa370eed692163) | [Is that booking for this step? No-shows, booking from the plan card, profile requests in Attention needed](commits/13-9202460.md) | 6 |
| 14 | [`58d3dbe`](https://github.com/legitzaisam/patientsys/commit/58d3dbe417f9a901c5fc9dce5e0c99f057fa8e66) | [Reporting periods in London time, one set of counting rules, and the Insights audit written up](commits/14-58d3dbe.md) | 5 |
| 15 | [`21dee87`](https://github.com/legitzaisam/patientsys/commit/21dee87b0fdd7571fe85261bd97e184842356ad8) | [Metrics refactor: one module per question, period picker rebuilt, scratch scripts removed](commits/15-21dee87.md) | 8 |

## Things worth knowing after this pull

- `/earnings` now redirects to `/profile`; earnings live on the **Performance** tab of My profile (`a9913cc`).
- The staff **notification bell shows new bookings only**; patient and team messages live in the floating chat bubble (`142563a`, `46dff1a`).
- Attention needed's **Treatment due** rows are exactly the journey board's Book chase, scoped per role (`789f666`), and profile change requests appear there for owners and managers (`9202460`).
- A booking only counts for a plan step when it was booked from the step or matches the plan's treatment; otherwise the step stays overdue and the other booking is named on the plan card (`9202460`).
- Every report reads one window definition in **Europe/London** time and one set of counting rules (`58d3dbe`, `21dee87`).
- `a9913cc` committed a `launch-plan/website/.tmp-claude/` folder (zips and temp JSON) that looks accidental, and `9202460` added three `check-*.mjs` scripts to the repo root that `21dee87` removed again.
- **Layout to look at:** on My profile → Performance at iPad landscape width (1024 px), the "Your performance" heading and subtitle are squeezed to a few characters per line beside the period picker and tab row, from `a9913cc` through `21dee87` (see [01](commits/01-a9913cc.md)).

## How this was made

- **Two worktrees.** The old app stayed alive in `~/aetheria-worktrees/before` (detached at `e956bfd`) while the main checkout pulled. A second worktree, `stepper`, was checked out at each of the 16 states (`d5a5789` then each commit) and the demo app started on port 8093 for each.
- **Same clock everywhere.** Every server ran with `DEMO=1 DEMO_NOW=2026-09-28T09:30:00Z`, so dates and numbers match between before and after.
- **Devices.** Desktop Chromium at 1440×1400, iPad Mini landscape and iPad Mini portrait (WebKit). Pages are captured full-page where the page scrolls, viewport-only for fixed panels and dialogs.
- **Scenes** are defined in `e2e/changelog/commit-captures.spec.ts`; each commit's scenes are listed in `scripts/changelog/walk-commits.mjs`. Open steps are tolerant: when a control did not exist at a commit, the page is captured as it was and the fact is recorded in `manifest.json` and under the image.
- **Rerun:** `node scripts/changelog/walk-commits.mjs` (add `--only <sha>` to redo one commit and its parent), then `node scripts/changelog/compose.mjs`, then `node scripts/changelog/write-docs.mjs`. Notes live in `scripts/changelog/notes-2026-09-28.mjs`.

Generated 2026-09-28.
