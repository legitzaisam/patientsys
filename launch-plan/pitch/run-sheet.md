# Demo run-sheet

Use with [`script.md`](script.md). `<url>` is your public address from `start-public.sh`
(for example `https://aetheria-demo.ngrok-free.dev`), or `http://localhost:8099` offline.

## 30 minutes before

- [ ] Mac on power, sleep off (`caffeinate -dims` in a spare terminal), notifications off.
- [ ] `./launch-plan/ngrok/doctor.sh` shows no ✗, then `./launch-plan/ngrok/start-public.sh`.
- [ ] Open `<url>` once on your phone to clear ngrok's one-time warning page for that device.
- [ ] Optional stable clock: `DEMO_NOW=2026-10-01T09:30:00Z` in `.env.local`, so the diary shows a busy morning.
- [ ] Browser zoom 110–125% so the back row can read it. Hide bookmarks bar.

## Tabs to pre-open (left to right)

Demo personas are cookies, so use **two browser profiles** (or a normal and a private window): one for the clinic,
one for the patient.

| Tab | Window  | Open                                                                                    | Then                                                                                                                                  |
| --- | ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Clinic  | `<url>/`                                                                                | Let the hero play once, scroll back to top                                                                                            |
| T2  | Clinic  | `<url>/demo/enter?role=front_desk` → **Diary** (`/schedule`)                            | Find Olivia Bennett's 15:00. The fixture leaves her consent unsigned on purpose, so the consent gate appears. Leave her at **Booked** |
| T3  | Clinic  | `<url>/demo/enter?role=practitioner` → Patients → **Olivia Bennett** → Record treatment | Keep the treatment form on page 1                                                                                                     |
| T4  | Patient | `<url>/demo/enter?role=patient` → **Home** (`/my-record`)                               | Open the care assistant bubble once so it's warm                                                                                      |
| T5  | Clinic  | `<url>/demo/enter?role=owner` → **Retention** (`/retention`)                            | Scroll to "Patients at risk"                                                                                                          |

T2, T3 and T5 share one browser profile, so the persona is whichever `/demo/enter` ran last. Open them in the order
T3 → T2 → T5 and switch persona with `/demo/enter?role=…` in the same tab if a page shows the wrong role.

## Click path per beat

| Time | Tab | Do                                                                                                         |
| ---- | --- | ---------------------------------------------------------------------------------------------------------- |
| 0:00 | T1  | Hero already landed; move the mouse slowly across the headline (the lens)                                  |
| 0:20 | T1  | Scroll through the six journey chapters, one per sentence                                                  |
| 0:50 | T2  | Tap **Arrived** on Olivia → consent dialog → sign → stage chip goes lilac → **Waiting**                    |
| 1:10 | T3  | Page 1 safety checks → page 2 results → page 3 aftercare → **Complete**                                    |
| 1:25 | T4  | Home → **Skin Plan & Journey** roadmap → journal                                                           |
| 1:35 | T4  | Care assistant: ask "What should I avoid tonight?", then "My cheek is swelling a lot" → shows the hand-off |
| 1:45 | T5  | Retention chart, at-risk list                                                                              |
| 1:50 | T1  | Safety section (seal locks), then the closing section                                                      |

## If something breaks

| Problem                     | Do this                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Venue Wi-Fi slow or blocked | Phone hotspot. ngrok needs outbound HTTPS only                                                              |
| Tunnel down                 | Switch every tab from `<url>` to `http://localhost:8099`; the demo works offline on the Mac                 |
| A page errors               | `/demo/enter?role=…` again in that tab resets the persona                                                   |
| Everything down             | Play the recorded walkthrough (record one after the first full rehearsal: QuickTime → New Screen Recording) |
| Demo data looks used up     | Stop and restart `start-public.sh`; demo data resets when the app restarts                                  |

## After

- `Ctrl-C` in the `start-public.sh` terminal stops everything.
- Check requests used in the ngrok dashboard (free plan: 20,000 a month).
