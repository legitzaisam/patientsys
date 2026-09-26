# Aetheria — Launch Plan: Public Access, Investor Pitch and Marketing Website

2026-09-26 · Karn Deb

## Summary

Aetheria can be public this week on a free ngrok URL running from the Mac in demo mode. It can be on its own domain within two weeks for about $10 a year, plus either $0 (Cloudflare Tunnel) or about $42 a month (ngrok Pay-as-you-go). The pitch leads with one patient's journey. The website is a motion-rich "light through skin" brand home with separate doors and sign-ins for patients and clinics.

| Workstream       | Recommendation                                                                                                                                                    | First step                                                                                                | Cost                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1. Public access | ngrok Free dev domain now; Hobbyist ($10/month) before investor meetings to remove the warning page                                                               | `brew install ngrok`, add authtoken, `ngrok http 8080 --url https://<dev-domain>` with `npm run dev:demo` | $0–$10/month                     |
| 1b. Domain       | One `.com` split into `www` (website), `clinic` (staff portal), `my` (patient portal); apex redirects to `www`                                                    | Trademark check, then buy on Cloudflare Registrar                                                         | ~$10/year + $0–$42/month         |
| 2. Pitch         | 2:50 script that follows one patient from arrival to aftercare, then shows the clinic's retention view; three swappable closes                                    | Fill in raise and pilot numbers; rehearse on the demo build                                               | —                                |
| 3. Website       | Astro site sharing the app's design tokens; hero "serum drop"; pinned journey scroll story; video hub for creator content; AI-drafted, clinician-reviewed Journal | Approve concept and audience weighting; optional motion prototype                                         | Hosting ~$0; video ~$0–$20/month |

Three constraints shape everything public:

- Only **demo mode** goes on a public URL until the live app has proper hosting and access controls.
- UK law bars advertising botulinum toxin to the public: patient-facing pages and creator videos promote consultations and skin health, not the medicine, and show no toxin before/after images.
- ngrok cannot attach an apex domain, and custom domains need its Pay-as-you-go plan.

## Part 1 — Exposing the app from localhost with ngrok

A free ngrok account gives one permanent `*.ngrok-free.dev` URL that tunnels to the app on your Mac, which is enough for demos; the catches are a browser warning page on first visit, 1 GB of traffic and 20,000 requests a month, and no custom domain until the $20 Pay-as-you-go plan ([ngrok pricing](https://ngrok.com/pricing), [free plan limits](https://ngrok.com/docs/pricing-limits/free-plan-limits)).

### 1.1 Plans that matter for Aetheria

| Plan          | Price               | Domains                                                                                                     | Traffic included                                   | Browser warning page | Fit                                                    |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------ |
| Free          | $0                  | 1 dev domain (`<name>.ngrok-free.dev`, fixed for the life of the account)                                   | 1 GB, 20k HTTP requests / month; 4,000 req/min     | Yes, on HTML pages   | Internal testing, webhook testing, a few demo sessions |
| Hobbyist      | $10 / month         | Dev domain + up to 10 ngrok-branded domains                                                                 | 5 GB, 100k requests                                | No                   | Investor and clinic demos on a clean ngrok URL         |
| Pay-as-you-go | $20 / month + usage | Bring your own domain at $0.01 per active hour (~$7.30 per domain per month if always on); wildcard domains | 5 GB then $0.10/GB; 100k requests then $1 per 100k | No                   | Own-brand domain served from localhost                 |

Other free-plan limits: 3 online endpoints, 3 concurrent agents, 5,000 TCP connections, 3 OAuth "traffic identities" a month, 1 user.

**Traffic warning.** The app ships several MB of JavaScript per first load, so 1 GB covers roughly 150–250 fresh page loads. That is fine for rehearsals but tight for a public launch ([comparison](https://ondelva.com/blog/2026/04/tailscale-vs-cloudflare-tunnel-vs-ngrok-2026)).

### 1.2 Account setup (one time)

1. Sign up at ngrok.com with the company Google or GitHub account and verify the email. Add a card only if you want TCP or a paid plan.
2. Install the agent on the Mac: `brew install ngrok`.
3. Copy the authtoken from **Getting Started → Your Authtoken** and run `ngrok config add-authtoken <token>` (stored in `~/Library/Application Support/ngrok/ngrok.yml`; never commit it).
4. Open **Universal Gateway → Domains** and note the dev domain that was created with the account, e.g. `aetheria-demo.ngrok-free.dev` ([how dev domains work](https://ngrok.com/blog/free-static-domains-ngrok-users)).
5. Optional: invite a second teammate only after upgrading (free plan is one user).

### 1.3 Run the app behind the tunnel

Two run modes, both on the same machine:

| Mode                                            | Command on the Mac                                   | Use it for              | Notes                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| **Demo mode** (recommended for anything public) | `npm run dev:demo` (port 8080)                       | Investor and user demos | Fixture clinic, no patient data, sandboxed email/SMS, role switcher to show every persona |
| **Live mode**                                   | `npm run build && npm run preview`, or `npm run dev` | Real clinic pilots      | Talks to the live Supabase project; must only be exposed with the protections in 1.5      |

Then, in a second terminal:

A reusable config keeps this to one command. Save as `ngrok.yml` outside the repo and start with `ngrok start --all` ([agent config v3](https://ngrok.com/docs/agent/config/v3)):

### 1.4 App changes needed before the public URL works (to plan, not to make now)

| Area                      | Change                                                                                                                                                   | Why                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite host check           | Allow the ngrok host in `server.allowedHosts` / `preview.allowedHosts` (e.g. `.ngrok-free.dev`), unless the Lovable Vite preset already allows all hosts | Vite rejects unknown `Host` headers with "Blocked request. This host is not allowed" since the 2025 security fix ([advisory](https://osv.dev/vulnerability/GHSA-vg6x-rcgg-rjx6)) |
| Supabase Auth             | Add `https://<domain>` to **Site URL / Redirect URLs** (Authentication → URL configuration)                                                              | Password-reset links, invites and OAuth return to the app via these URLs                                                                                                         |
| OAuth (Google, Microsoft) | No change at Google/Microsoft; the provider redirects to the Supabase callback. Only Supabase's redirect allowlist needs the new domain                  | Keeps OAuth working on the new host                                                                                                                                              |
| `APP_ORIGIN`              | Set to the public URL                                                                                                                                    | Consent magic links, payment links, unsubscribe links and offer emails are built from it                                                                                         |
| Webhooks                  | Point Resend and Twilio status webhooks at `https://<domain>/api/comms/webhooks/{resend,twilio}`                                                         | Delivery status needs a public URL; the free plan's 500 webhook verifications a month is enough                                                                                  |
| Outbox drain              | Cron (or `pg_cron`) posts to `https://<domain>/api/comms/drain` with the bearer secret                                                                   | Sends queued reminders and offers                                                                                                                                                |
| Insights ingest           | Website events post to `https://<domain>/api/insights/events`                                                                                            | Lead tracking from the marketing site                                                                                                                                            |

### 1.5 Safety when the live app is public

- Demo mode for anything public: its role switcher lets any visitor act as owner, which is fine for fixtures and unacceptable for real data.
- For a live pilot, gate the tunnel with ngrok's Traffic Policy (OAuth or basic auth, IP allowlist) on a paid plan, and keep MFA on for owner/manager (needs Resend configured).
- The laptop is the server: if it sleeps, the site is down. For anything beyond demos, move to proper hosting (Part 1b, 2.2 and 2.5).
- The free plan's warning page can be skipped for API calls with the `ngrok-skip-browser-warning` header, but real visitors will see it once; budget $10 for Hobbyist before showing investors.

## Part 1b — Domains and subdomains

Buy one `.com` (about $10.46 a year at cost on Cloudflare Registrar) and split it into three hostnames: `www` for the marketing website, `clinic` for the staff portal and `my` for the patient portal. ngrok can serve all three from your Mac on the Pay-as-you-go plan for roughly $42 a month; Cloudflare Tunnel does the same for free once the domain's DNS is on Cloudflare.

### 2.1 Target layout

| Hostname                  | Serves                             | App paths behind it                                                | Why separate                                                                       |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `aetheria.<tld>` (apex)   | Redirect to `www`                  | —                                                                  | ngrok does not support apex domains; the registrar or Cloudflare redirects it      |
| `www.<domain>`            | Marketing website, blog, video hub | `/`, `/blog`, `/treatments`, ...                                   | Public, SEO-indexed, fast static pages                                             |
| `clinic.<domain>`         | Clinic portal                      | `/auth`, `/dashboard`, `/schedule`, `/patients`, ... plus `/api/*` | Staff-only; can carry stricter access rules and `noindex`                          |
| `my.<domain>`             | Patient portal                     | `/portal`, `/my-record/*`, `/d/$token`, `/u/$token`                | Patient-facing links (consent, unsubscribe, offers) read as the clinic's own brand |
| `status.<domain>` (later) | Uptime page                        | —                                                                  | Trust signal for clinics                                                           |

The clinic and patient hosts point at the same app. A small redirect rule sends `clinic.` root to `/auth` and `my.` root to `/portal`. Sessions are stored per origin, so a staff session and a patient session on the same browser stay separate, which matches the app's two sign-in surfaces.

### 2.2 Options compared

| Option                                                                                       | Monthly cost                                      | Own domain                                    | Warning page | Runs from        | Best for                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------------------- |
| ngrok Free                                                                                   | $0                                                | No, one `*.ngrok-free.dev`                    | Yes          | Your Mac         | Now: rehearsals and webhook tests                                                 |
| ngrok Hobbyist                                                                               | $10                                               | No, up to 10 ngrok-branded names              | No           | Your Mac         | Investor demos on clean URLs (for example one name for the site, one for the app) |
| ngrok Pay-as-you-go                                                                          | $20 + ~$7.30 per always-on domain (3 hosts ≈ $42) | Yes, CNAME per host; wildcard supported       | No           | Your Mac         | Branded demos while still on localhost                                            |
| Cloudflare Tunnel                                                                            | $0 (tunnel is not metered)                        | Yes, any subdomain on a Cloudflare-DNS domain | No           | Your Mac         | Branded, free, laptop-hosted                                                      |
| Real hosting (Cloudflare Workers/Pages, which the build already targets, or Lovable publish) | $0–$5 to start                                    | Yes                                           | No           | Cloud, always on | Pilots with real clinics                                                          |

Sources: [ngrok pricing](https://ngrok.com/pricing), [ngrok custom domains](https://ngrok.com/docs/guides/other-guides/how-to-set-up-a-custom-domain/), [Cloudflare Tunnel DNS](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/), [Cloudflare Registrar prices](https://tldspy.com/registrar/cloudflare).

### 2.3 Buying and attaching a domain (ngrok path)

1. **Choose and check the name.** Search availability for a short `.com` plus the UK variant; run a UK IPO and EUIPO trademark search on "Aetheria" in classes 9, 42 and 44 before paying for branding.
2. **Register it.** Cloudflare Registrar sells at cost: `.com` $10.46/yr, `.uk` $5.30/yr, `.app` $14.20/yr, `.co` $30/yr. It does not sell `.clinic`, `.skin`, `.health` or `.co.uk`; those need Namecheap, Porkbun or Gandi at higher prices.
3. **Upgrade ngrok to Pay-as-you-go.** Custom domains are not available on Free or Hobbyist.
4. **Add each host in ngrok** (Universal Gateway → Domains → New): `www`, `clinic`, `my` (or one wildcard `*.<domain>`, which needs a second CNAME for its certificate).
5. **Create DNS records** at the registrar: one CNAME per host to the target ngrok shows. Add a redirect from the apex to `www`.
6. **Start the endpoints** from one config file with `ngrok start --all`: `www` → website port (for example 3000), `clinic` and `my` → app port 8080.
7. **Wait for TLS.** ngrok issues certificates automatically within minutes.
8. **Update the app settings** from Part 1, 1.4 with the new hosts: Supabase redirect URLs, `APP_ORIGIN` (use the `my.` host for patient links), provider webhooks, Resend sending domain (SPF, DKIM, DMARC on the same domain).

### 2.4 The same with Cloudflare Tunnel (free alternative)

1. Register the domain on Cloudflare (DNS is then already on Cloudflare).
2. `brew install cloudflared`, `cloudflared tunnel login`, `cloudflared tunnel create aetheria`.
3. Route hosts: `cloudflared tunnel route dns aetheria www.<domain>` (repeat for `clinic`, `my`); each becomes a CNAME to `<tunnel-id>.cfargotunnel.com`.
4. Map hosts to local ports in `~/.cloudflared/config.yml` and run `cloudflared tunnel run aetheria`.

Caveat: if the laptop is off, visitors see a Cloudflare 1016 error. Either tunnel option is a bridge, not production hosting.

### 2.5 Recommendation

- **This week:** ngrok Free on the dev domain for rehearsals; upgrade to Hobbyist ($10) before the first investor meeting to remove the warning page.
- **Before public launch:** buy the `.com` on Cloudflare, stand up `www`, `clinic` and `my`, and choose between ngrok Pay-as-you-go (~$42/month, stays on the Mac) and Cloudflare Tunnel (free).
- **Before real patient data:** move to always-on hosting, with a UK/EU region and the Phase 6 auth hardening done.

## Part 2 — Market context and where Aetheria is different

Aesthetic-clinic software is crowded but built around the clinic's diary and till; almost nobody treats the **patient's treatment journey** as the product. Aetheria's opening is to own the journey from first consultation to the fifth session, for both the clinic and the patient, just as UK regulation starts to demand the records and oversight that journey produces.

### 3.1 Market facts to quote

| Fact                 | Figure                                                                                                                                                                                                                                                                                                                                  | Source                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK aesthetics market | £3.2bn (2024), projected above £3.6bn in 2026; 8–9% growth expected in 2026                                                                                                                                                                                                                                                             | [PolicyBee roundup](https://www.policybee.co.uk/blog/aesthetics-industry-statistics)                                                                       |
| Injectables share    | About 65% of UK aesthetics revenue from botulinum toxin and fillers                                                                                                                                                                                                                                                                     | same                                                                                                                                                       |
| Providers            | 5,589 UK locations offering botulinum toxin; 19,701 practitioners (UCL, Feb 2026)                                                                                                                                                                                                                                                       | same                                                                                                                                                       |
| Treatments           | About 900,000 botulinum toxin treatments a year in the UK                                                                                                                                                                                                                                                                               | same                                                                                                                                                       |
| Patient mix          | Over half of filler patients are under 35; 70% rise in men having treatments since 2021                                                                                                                                                                                                                                                 | same                                                                                                                                                       |
| Trust gap            | 84% of 41–50 year olds worry about safety and product quality                                                                                                                                                                                                                                                                           | same                                                                                                                                                       |
| Software market      | Medical-spa management software $338.8m (2024) → $1.3bn by 2034, 13.9% CAGR; described as fragmented                                                                                                                                                                                                                                    | [Global Market Insights](https://www.gminsights.com/industry-analysis/medical-spa-management-software-market)                                              |
| Regulation           | England's planned licensing scheme (consultation outcome Aug 2025): green / amber / red tiers; botulinum toxin and face fillers are **amber**, so non-healthcare practitioners need a licence and a named healthcare professional's oversight; red procedures go to CQC. Scotland passed its non-surgical procedures bill in March 2026 | [CMS legal update](https://cms.law/en/gbr/legal-updates/regulating-beauty-what-the-government-s-consultation-means-for-non-surgical-procedures), PolicyBee |

The figures above come from secondary roundups; check the primary sources before they go on a slide.

### 3.2 Competitor landscape

| Product                                      | Home market        | Price signal                                                                             | Strengths                                                                                                            | Where it stops                                                                                                                                           |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pabau                                        | UK, international  | From $62/month, all features ([Pabau](https://pabau.com/blog/aesthetic-record-pricing/)) | Broad all-in-one: EMR, injection plotting, photos, consent, patient portal; AI scribe and photo analysis rolling out | Reviewers cite weeks of setup and a cluttered interface ([Calyx comparison](https://www.usecalyx.app/blog/aesthetic-clinic-software-comparison-uk-2026)) |
| Aesthetic Record                             | US                 | $15–$19 per user/month + $399 onboarding                                                 | Charting, photo management, portal for booking and forms                                                             | Per-user pricing climbs with team size; US-first (HIPAA)                                                                                                 |
| Consentz                                     | UK                 | Not published                                                                            | Injectable-specific consent, CQC-ready audit trails                                                                  | Pricing opacity; clinic-side focus                                                                                                                       |
| Clinicminds                                  | NL / international | Not published                                                                            | Records, photos, consent, invoicing; Quinn dictation                                                                 | Patient experience not a headline                                                                                                                        |
| Phorest                                      | UK and Ireland     | Not published                                                                            | Salon-grade retention and loyalty marketing                                                                          | Lacks medical-grade injectable templates                                                                                                                 |
| Nextmotion                                   | France / EU        | Not published                                                                            | Guided medical photography, AR patient education, AI consult notes                                                   | Imaging-led; EU/HDS focus                                                                                                                                |
| Zenoti, Boulevard, Mangomint, Vagaro, Fresha | US / global        | Varies                                                                                   | Multi-site ops, payments, memberships                                                                                | Spa and salon heritage; clinical journey is thin                                                                                                         |
| Calyx                                        | UK                 | Transparent (not quoted)                                                                 | POM prescription management, fast setup                                                                              | New, small integration ecosystem                                                                                                                         |

### 3.3 Aetheria's differentiators (what is actually built)

1. **The journey is the product.** Treatment plans with month-grouped milestones, checklists and pause requests. Patients get a live roadmap, a journal, a skincare routine with adherence, recovery check-ins and before/after progress. Competitor portals mostly stop at booking, forms and payments.
2. **Consent-gated clinical workflow.** A patient cannot move to "waiting" or start treatment without a signed consent. In-clinic signatures are witnessed by the logged-in staff member, and signed documents are immutable in the database. The three-page treatment form writes the treatment, visit note, photos and plan progress in one step.
3. **Built for the coming UK licensing regime.** Named practitioner on every record, audit log of every action, 8-year retention with legal hold, practitioner registration details and staff compliance documents, and clinic data isolation. These are the records the amber tier's oversight rules will ask for.
4. **Retention that runs itself, legally.** At-risk scoring (overdue, lapsing, lost), recall tasks, and stage-based offers that go out automatically on email, SMS and the portal. UK PECR consent rules are enforced in code, and every marketing email carries a one-click unsubscribe.
5. **Safe AI where it helps.** A patient care assistant that answers from the patient's own plan and routes symptoms such as swelling, infection or vision changes straight to a human. Also AI offer drafting and product-link extraction for routines.
6. **Role-shaped and beautiful.** Each role gets its own dashboard (owner, practitioner, front desk) and a per-role visibility catalogue. The glass "notebook" design reads like a consumer app rather than an admin panel.
7. **Practitioner economics built in.** Commission snapshots per treatment, earned vs collected vs owed, and a personal earnings view.

### 3.4 Honest gaps to acknowledge (and roadmap answers)

| Gap                                         | Competitors that have it        | Answer in the pitch                                                                   |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| Live email/SMS delivery not yet switched on | All incumbents                  | Transport, outbox, retries and webhooks are built; provider accounts go live at pilot |
| Card payments and POS                       | Pabau, Aesthetic Record, Fresha | Payment links today; Stripe integration on roadmap                                    |
| Stock, batch tracking and POM prescribing   | Pabau, Calyx                    | Roadmap; batch capture already fits the treatment form                                |
| Native mobile apps                          | Several                         | Responsive web portal first; PWA next                                                 |
| Integrations ecosystem                      | Pabau, Zenoti                   | Open insights ingest API already exists                                               |

## Part 2 — The pitch: 2 minutes 50 seconds

The script runs about 430 words, which is 2:50 at a calm 150 words a minute. It follows one patient, Olivia, through one treatment so the audience remembers a story, not a feature list. Square brackets are what to show on screen; bracketed placeholders like [raise] need your numbers.

### 4.1 Script

**0:00–0:20 — Hook**

> Every year in the UK, around nine hundred thousand people have anti-wrinkle injections. Most of them sign a paper form, get a text reminder, and then hear nothing until they're overdue. The clinic loses them. And when something goes wrong, nobody can say who signed off what.

[Screen: landing page hero, then the patient portal home.]

**0:20–0:45 — The problem**

> Clinic software today is built around the diary and the till. It books the slot and takes the money. But aesthetics isn't a transaction. It's a journey: consultation, consent, treatment, aftercare, review, the next session. And that journey lives in WhatsApp threads, paper forms and people's heads. Meanwhile regulation is arriving. England's new licensing scheme will expect named practitioners, supervision and proper records for injectables.

**0:45–1:50 — The product (the demo moment)**

> This is Aetheria. One platform, two portals.
>
> Olivia books her second session. [Diary card.] When she arrives, reception taps Arrived. Aetheria checks her consent. If it isn't signed, she signs on the clinic's tablet, witnessed and locked, and only then moves to Waiting. [Consent dialog, then stage chip turns lilac.] Her practitioner gets a nudge and opens a three-page treatment form: safety checks, results, aftercare. One click, and the treatment, photos, notes and plan progress are all saved. [Treatment form, Complete.]
>
> Now Olivia's side. [Patient portal.] She sees her whole plan as a roadmap, what's done, what's next, what to prepare. She logs her skin in a journal, follows her routine, and asks our care assistant anything. If she mentions swelling or pain, it hands her straight to a human. [AI bubble answer, then the escalation.]
>
> And for the owner [Retention page]: Aetheria spots who is drifting away and sends the right offer at the right stage, automatically, and only to people who have consented to marketing.

**1:50–2:20 — Why we win**

> Three things nobody else puts together. First, the journey is the product, for the clinic and the patient. Second, compliance by design: consent gates, locked records, audit trails and eight-year retention, ready for licensing. Third, retention that runs itself inside UK marketing law. And it looks like something patients want to open.

**2:20–2:50 — Market and close (investor version)**

> The UK market is over three billion pounds and growing eight to nine percent a year, with more than five and a half thousand clinics offering injectables. Clinic software is fragmented and dated. We have a working product across every clinic role and a full patient portal. We're raising [raise] to launch with [N] pilot clinics in London and turn on payments and messaging. Aetheria: the journey is the product. Thank you.

### 4.2 Alternative closes (swap the last 30 seconds)

| Audience                       | Close                                                                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinic owners                  | "You already have the patients. Aetheria keeps them: consent handled before they sit down, every treatment recorded in one step, and the ones drifting away brought back automatically. We're taking [N] founding clinics this quarter, with onboarding done for you." |
| Practitioners                  | "Walk into every appointment with the history, the consent and the last visit's notes in front of you, and walk out with the record already written."                                                                                                                  |
| Patients / influencer audience | "Your skin plan in your pocket: what's next, how to prepare, your routine, your progress photos, and your clinic one tap away. Ask your clinic if they're on Aetheria."                                                                                                |

### 4.3 Delivery notes

- Rehearse on the demo build with the fixture clinic; never demo on live patient data.
- Keep the screen one step behind the words: the audience should hear the benefit, then see it.
- Say numbers once, slowly. Cut the market paragraph for non-investor audiences and give that time to the patient portal.
- Pre-open four tabs: diary, patient record with `?treat=`, patient portal home, retention. Tab-switching beats clicking through menus live.
- Keep regulated product names generic in public or recorded versions ("anti-wrinkle injections" rather than a brand), which also keeps the recording usable in UK advertising (see Part 3, 7.4). Note that the regulator may read "anti-wrinkle injections" as a reference to a prescription-only medicine too, so public recordings should describe consultations and the software rather than the treatment.

## Part 3 — Website strategy

The website is Aetheria's brand home with two doors: a consumer-grade skincare experience for **patients** (education, stories, video, their portal) and a product site for **clinics** (features, compliance, pricing, demo). Both share one motion language and put the two logins in the top bar.

### 5.1 Audiences and what each must leave with

| Audience                               | Arrives from                                                                           | Needs to feel                                | Primary action                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Patients and skincare-curious visitors | Instagram / TikTok creators, search ("how long does filler last"), their clinic's link | Safe, informed, looked after                 | Read, watch, sign in to their portal, ask their clinic |
| Clinic owners and managers             | Search, events, word of mouth, outbound                                                | "This runs my clinic and keeps me compliant" | Book a demo, start a pilot                             |
| Practitioners                          | Owner referrals, training academies                                                    | "My day gets easier"                         | Explore the product tour                               |
| Investors and press                    | Direct links from the pitch                                                            | Momentum, clarity, quality                   | Watch the product film, read About / press kit         |

### 5.2 Sitemap

| Section        | Pages                                                                                                                                                                  | Notes                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Home           | One page with a scroll story                                                                                                                                           | Hero, the journey, two doors, video, journal highlights, trust, CTA      |
| For patients   | Your skin journey (portal tour) · Treatments explained (education hub) · Aftercare library · Stories (video hub) · Patient FAQ · Find a clinic (phase 2)               | Educational tone only; no promotion of prescription-only medicines (7.4) |
| For clinics    | Product overview · Diary · Records and consent · Treatment journeys · Patient portal · Retention and offers · Insights and reports · Team and access                   | One deep page per module, each with an interactive mini-demo             |
| Compliance     | Licensing readiness (England, Scotland) · Consent and records · Data protection (UK GDPR) · Trust centre (hosting region, security, retention, sub-processors, status) | Strongest differentiator; also ranks for regulation searches             |
| Pricing        | Plans, per-location pricing, founding-clinic offer, FAQ                                                                                                                | Transparent pricing is itself a differentiator (competitors hide theirs) |
| Journal (blog) | Hub, category pages, article pages, author pages, reviewer pages                                                                                                       | See Part 3, section 7                                                    |
| Watch          | Video hub: creator stories, treatment explainers, clinic spotlights, product films                                                                                     | Uploadable video module (6.6)                                            |
| Company        | About · Clinical advisory board · Careers · Press kit · Investors (product film + contact) · Contact                                                                   | Advisory board page is a key trust signal                                |
| Access         | Clinic login → `clinic.<domain>/auth` · Patient login → `my.<domain>/portal` · Book a demo                                                                             | Always visible in the top bar and footer                                 |
| Legal          | Privacy · Cookies (consent banner) · Terms · Accessibility statement · Medical disclaimer · Complaints                                                                 | Required for a health-adjacent UK site                                   |
| Utility        | Designed 404, search, newsletter confirmation, thank-you pages with next steps                                                                                         | Small moments that carry the brand                                       |

### 5.3 Conversion paths

1. **Creator video → story → education → portal.** A patient lands on a creator's story, watches, reads the linked treatment explainer, and is offered "Is your clinic on Aetheria?" or "Sign in to your plan".
2. **Search → article → clinic product page → demo.** A clinic owner searching the licensing scheme reads the guide, sees how Aetheria covers each requirement, and books a demo from an inline card.
3. **Pitch link → product film → investors page.** Investors get the film, the traction and a contact form in two clicks.

### 5.4 Evidence behind the choices

- Treatment-specific pages convert at 4–8% versus 1–2% for generic medspa sites, and before/after galleries are the single highest-converting element (+30–60%) ([Web Tonic](https://www.webtonic.io/blog/medical-spa-landing-page-statistics)). The clinic module pages mirror this: one focused page per job.
- Mobile-first pages that load within 2.5 s lift conversion 10–20% (same source). This sets the performance budget in 8.2.
- "Trust clarity drives consultation quality": practitioner credentials, process and suitability belong before the call to action ([Unicorn Platform](https://unicornplatform.com/blog/med-spa-websites-in-2026/)).
- Award-winning skincare sites pair a restrained two-tone palette with smooth page transitions, a branded loader, parallax and micro-interactions ([Truekind on Awwwards](https://www.awwwards.com/sites/truekind-skincare), [Koba](https://www.awwwards.com/sites/koba-skincare)).

## Part 3 — Motion and visual design

The creative idea is **"light through skin"**: everything moves the way light, serum and healthy skin move. It is translucent, dewy and slow to settle, and the one golden thread of the patient's journey runs through every page. The palette, glass surfaces and butter-gold accent carry over from the product, so the site and both portals feel like one brand.

### 6.1 Motion principles

| Principle   | What it means on screen                                                           | Where it shows                              |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| **Dew**     | Viscous, liquid easing: elements arrive fast and settle softly, never bounce      | Buttons, cards, page transitions            |
| **Renewal** | Layers peel and re-form like cell turnover; content reveals in stacked masks      | Text reveals, section changes, before/after |
| **Glow**    | Light is the cursor and the reward; hovering brightens glass, success blooms gold | Cursor light, CTAs, completed steps         |
| **Thread**  | One continuous gold line links every step of a journey                            | Hero, journey story, footer                 |
| **Calm**    | Nothing loops faster than 6 s, nothing flashes; motion serves reading             | Everywhere; full reduced-motion mode        |

**Motion tokens**

| Token          | Value                                                                     | Use                             |
| -------------- | ------------------------------------------------------------------------- | ------------------------------- |
| `--ease-dew`   | `cubic-bezier(0.22, 1, 0.36, 1)` (already in the app)                     | Default enter                   |
| `--ease-serum` | spring: stiffness 120, damping 22, mass 1.1                               | Draggable and magnetic elements |
| `--ease-peel`  | `cubic-bezier(0.65, 0, 0.35, 1)`                                          | Layer masks, page wipes         |
| Durations      | 160 ms (micro) · 320 ms (UI) · 640 ms (section) · 1,200 ms (hero, loader) |                                 |
| Stagger        | 40–60 ms per item, capped at 8 items                                      | Lists, grids                    |

### 6.2 Visual system

- **Colour:** product tokens (ink `#2f3f66`, butter `#eed488`, success `#4a9d75`, consent lilac, rose) plus a **skin-light neutral ramp** from porcelain to deep umber for backgrounds, gradients and illustration. Every illustrated skin surface rotates through the full ramp so no single skin tone is "default".
- **Type:** Space Grotesk (product continuity) for UI and body; a high-contrast editorial serif (for example Fraunces or Instrument Serif) for display headlines and article titles.
- **Surfaces:** frosted glass cards, the 14 px notebook rule as a faint page texture, radial blooms of butter and peach.
- **Imagery:** macro skin texture, serum and droplet photography, real clinicians and real patients across ages, genders and skin tones. No heavy retouching or filters on results imagery, since the UK advertising regulator treats filtered cosmetic results as misleading.
- **Iconography:** 1.5 px line icons matching lucide in the app; animated state icons such as the consent lock and the stage dots.

### 6.3 Hero concepts (pick one; B is recommended)

| Concept                             | What happens                                                                                                                                                                                                                                      | Tech                                                                                                                             | Weight                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **A. The living skin**              | A macro skin surface, softly lit by a moving light that follows the cursor. Scrolling dives through the layers (surface → dermis → collagen lattice) with calm labels, then surfaces into the journey                                             | WebGL shader (normal-mapped texture + light), React Three Fiber, GSAP ScrollTrigger                                              | Heavy; the "science" section is a better home         |
| **B. The serum drop** (recommended) | A single glass droplet falls in slow motion and lands on the page. The ripple refracts the headline into place ("The journey is the treatment"). The droplet settles into the Æ mark and splits into two glowing doors: For patients, For clinics | R3F `MeshTransmissionMaterial` for refraction, ripple displacement shader, GSAP timeline; a 2-second pre-rendered video fallback | Medium; iconic and on-brand                           |
| **C. The journey thread**           | A gold thread draws across the screen; six milestones bloom along it as glass cards (Consult, Consent, Treatment, Aftercare, Review, Next session) with the portal's real UI inside                                                               | SVG path drawing + GSAP, no WebGL                                                                                                | Light; also the reduced-motion and low-power fallback |

### 6.4 Home page, section by section

1. **Loader (≤ 1.2 s, first visit only).** A droplet forms the Æ mark; a progress ring fills in butter gold. Skipped on repeat visits and when assets are cached.
2. **Hero (serum drop).** Headline, one-line promise, and two doors with magnetic hover. The top bar carries **Sign in ▾** (Clinic / Patient) and **Book a demo**.
3. **Two doors.** A split screen. Hovering a side widens it to 65% and plays a looping micro-scene: clinic side, diary cards gliding into place; patient side, the plan roadmap lighting up. Clicking morphs the card into the next page (View Transitions API shared element).
4. **The journey (pinned scroll story).** A device frame stays pinned while the gold thread advances through six chapters. Each chapter swaps a **real screenshot** of the portal with a glass caption: consent signed and locked, the three-page treatment form, aftercare, the patient's roadmap. The scroll scrubs the thread; chapter numbers roll.
5. **Before and after.** Skin-quality treatments only (microneedling, peels, laser), never toxin results (7.4). A drag slider with a soft light sweep on release, a consent badge ("Shared with permission") and the treatment and time between images. Inclusive tone set.
6. **Clinic OS bento.** A grid of live mini-UIs built in code, not video: a diary card sliding between practitioners; a stage chip moving Booked → Arrived → Waiting → Complete; a retention curve drawing itself; an offer email assembling. Each tile expands into its module page.
7. **Safety by design.** A signature writes itself, then a gold ring closes into a padlock ("Signed. Witnessed. Locked."). Below, three facts count up with tabular numerals: audit trail, 8-year retention, UK data isolation.
8. **Watch.** A cinematic rail of vertical 9:16 creator videos with hover-to-preview (muted, 3 s). A click opens theatre mode with a shared-element zoom (spec in 6.6).
9. **Journal.** Three featured articles on parallax image cards showing reading time and a "Clinically reviewed by" badge.
10. **Voices.** A slow marquee of clinician and patient quotes (real, permissioned) and the clinical advisory board.
11. **Closing CTA.** A gold aurora gradient drifts behind two buttons: Book a demo and Sign in.
12. **Footer.** Notebook lines draw in; the wordmark catches a light sweep; legal links, newsletter, socials.

### 6.5 Sign-in experience

- **Top-bar menu:** "Sign in ▾" opens a small glass panel with two rows: _Clinic team_ (→ `clinic.<domain>/auth`) and _Patients_ (→ `my.<domain>/portal`), each with a one-line description.
- **`/login`**** page on www:** a full-screen split, clinic scene on the left (soft diary grid) and patient scene on the right (the journey thread). The hovered side brightens and expands. Choosing a side plays a 400 ms light wipe into the correct portal, which already uses the same tokens, so the hand-off feels seamless.
- **Deep links:** offer emails and consent links go straight to `my.` and never through the marketing site.

### 6.6 Video and influencer module

| Element     | Specification                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formats     | 9:16 creator shorts, 16:9 product films, 1:1 clips for article embeds                                                                                                                          |
| Hosting     | Adaptive streaming (HLS) through Mux or Cloudflare Stream; auto thumbnails, poster frames, captions (WebVTT) required before publish                                                           |
| Upload      | CMS entry: video file, title, creator (name, handle, avatar), relationship (paid / gifted / organic), linked treatment article, linked clinic, consent record for anyone shown, publish window |
| Disclosure  | Paid or gifted content shows an "Ad" / "Paid partnership" label on the card and in the player, as UK ad rules require                                                                          |
| Layouts     | Hero reel on Home; Watch hub with filters (treatment, creator, clinic); inline embeds in articles; "stories" row on the patient page                                                           |
| Player      | Custom glass controls, captions on by default when muted, chapter markers, "Read the guide" and "Find a clinic" end cards                                                                      |
| Motion      | Hover preview; shared-element zoom into theatre mode; background dims with a bloom; swipe between shorts on mobile                                                                             |
| Measurement | Plays, completion, click-through to guide or clinic; events feed the app's Insights ingest API                                                                                                 |

### 6.7 Micro-interactions catalogue

Cursor light (a soft radial glow that brightens glass under it; off on touch) · liquid-fill buttons · magnetic CTAs · line-by-line text reveals behind masks · number rolls · image "peel" reveals · gold success bloom on form submit · consent-lock seal · journey dots that fill as you scroll · page transitions with a butter light wipe · skeletons shaped like the real content.

## Part 3 — Content and blog strategy

Publish two streams on one Journal: **skin-health education for patients**, which earns search traffic and trust, and **practical guides for clinic owners**, which earn demos. Both are drafted with AI and published only after a named clinician and a compliance check review them. Health content is judged harder by Google ("Your Money or Your Life") and advertising law, so the review step is the product, not overhead.

### 7.1 What people are searching for

- UK search interest in **microneedling** more than doubled between late 2023 and mid-2026; **polynucleotides** went from near zero to a clearly rising category; interest in botulinum toxin grew about a third but is steady; generic filler interest is flat ([search-data analysis](https://thebusinessjournal.co.uk/business-insights/the-changing-face-of-aesthetics-what-search-data-suggests-about-the-uks-beauty-market/)).
- 2026 themes: regenerative treatments over volume, "undone" natural results, prejuvenation in the mid-20s to early 30s, treatment stacking, and AI skin analysis ([Meridiq trends](https://meridiq.com/en/aesthetic-trends/uk-aesthetic-trends-2026/)).
- Regulation is a live search topic for both audiences: England's licensing scheme and Scotland's new law.

### 7.2 Topic clusters

| Cluster                            | Audience           | Pillar page                            | Example articles                                                                                                                                        |
| ---------------------------------- | ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skin science                       | Patients           | How skin renews itself                 | Collagen explained; what "skin quality" actually means; the skin barrier in winter                                                                      |
| Treatments explained               | Patients           | A calm guide to skin treatments        | Microneedling: what to expect, week by week; chemical peels by skin type; what polynucleotides are and what the evidence says; laser and skin of colour |
| Safety and choosing a practitioner | Patients           | How to choose a safe clinic in the UK  | Questions to ask at a consultation; what the new licensing scheme means for you; what a consent form should cover                                       |
| Aftercare and routines             | Patients           | Aftercare library                      | The first 48 hours after microneedling; SPF after a peel; building a routine around a treatment plan                                                    |
| Journey stories                    | Patients           | Stories hub (video + text)             | A 12-week skin plan, month by month (with consent); a first consultation, filmed                                                                        |
| Licensing and compliance           | Clinics            | The UK licensing readiness guide       | Green, amber, red: what each tier means for your menu; records the regulator will ask for; consent that stands up                                       |
| Running a modern clinic            | Clinics            | The clinic operations playbook         | Cutting no-shows with deposits and reminders; the second-visit problem; commission models that work                                                     |
| Marketing within the rules         | Clinics            | Marketing an aesthetics clinic legally | What you can say about prescription-only medicines; PECR and consent for offers; working with creators under ASA rules                                  |
| AI in aesthetics                   | Both               | AI in the clinic, used safely          | What an AI care assistant should never answer; AI notes and consent; skin analysis tools compared                                                       |
| Product and company                | Clinics, investors | Changelog                              | Release notes, customer spotlights, research                                                                                                            |

Cadence to start: two patient articles and one clinic article a week, three short videos a week, and a monthly pillar refresh.

### 7.3 AI-written blog workflow

1. **Brief.** An editor picks a topic from the cluster map and sets audience, search intent, target question, sources to use and call to action.
2. **Draft.** An AI model writes from the brief and the approved source pack (NHS, BAD, JCCP, peer-reviewed papers, regulator pages, Aetheria product docs), citing a source for every factual sentence. The app already has an AI integration pattern (Cohere) that a CMS step can reuse.
3. **Fact check.** Automated link and claim check, then a human confirms every citation.
4. **Clinical review.** A named clinician on the advisory board (with GMC, NMC or GDC number) edits and signs off.
5. **Compliance review.** The checklist in 7.4 is applied, especially the prescription-only medicines rule.
6. **Publish.** Byline shows author, "Clinically reviewed by" with the date, and "Drafted with AI assistance"; structured data for `Article`/`MedicalWebPage` with `author` and `reviewedBy`.
7. **Refresh.** A review date is set on every article (6 months for clinical, 3 months for regulation), and changes are logged on the page.

Google does not penalise AI assistance as such; it ranks helpful, expert, trustworthy content, and its spam policies target mass-produced pages made to game rankings ("scaled content abuse") ([Google Search Central](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)). The review steps and named experts are what keep AI drafts on the right side of that line.

### 7.4 UK advertising and content rules the site must follow

| Rule                                                                             | What it means for the website and videos                                                                                                                                                                                                                                                                                                    | Source                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prescription-only medicines (botulinum toxin) cannot be advertised to the public | No product names, hashtags or promotional mentions in patient-facing pages or creator content; promote **consultations** ("a consultation for lines and wrinkles") instead; no before/after images for toxin treatments; no celebrity or clinician endorsement of the medicine. Pages aimed at clinics (professionals) may discuss products | [ASA/CAP botulinum toxin guidance](https://www.asa.org.uk/advice-online/beauty-and-cosmetics-botulinum-toxin-products.html), [enforcement notice](https://www.asa.org.uk/resource/enforcement-notice-botox-social-media.html) |
| Filters and retouching                                                           | No filters or retouching on images that show results; the advertiser is responsible and must hold evidence                                                                                                                                                                                                                                  | [ASA on beauty filters (Feb 2021)](https://www.asa.org.uk/news/the-mis-use-of-social-media-beauty-filters-when-advertising-cosmetic-products.html)                                                                            |
| Influencer disclosure                                                            | Paid or gifted creator content must be clearly labelled as advertising ("Ad") on the site as well as on social                                                                                                                                                                                                                              | ASA / CAP influencer guidance                                                                                                                                                                                                 |
| Under-18s                                                                        | Do not target cosmetic-intervention marketing at under-18s; age-gate creator campaigns                                                                                                                                                                                                                                                      | CAP rules on cosmetic interventions                                                                                                                                                                                           |
| Claims                                                                           | Every efficacy claim needs evidence; avoid playing on insecurity or urgency ("fix your wrinkles before it's too late")                                                                                                                                                                                                                      | CAP Code                                                                                                                                                                                                                      |
| Patient stories and images                                                       | Written, specific consent for every image and quote; right to withdraw; stored against the patient record in the app                                                                                                                                                                                                                        | UK GDPR (special category data)                                                                                                                                                                                               |
| Cookies and tracking                                                             | Consent banner before analytics or ad pixels; health-page tracking kept minimal                                                                                                                                                                                                                                                             | PECR, ICO guidance                                                                                                                                                                                                            |

Action from this table: the home page's before/after section (6.4, item 5) uses skin-quality treatments such as microneedling and peels, never toxin results.

## Part 3 — Technical approach for the website

Build the website as a separate, static-first app (Astro with React islands) in the same repository as the portals, sharing the design tokens, and serve it on `www`. Heavy motion loads only after the first paint and only on devices that can take it, so the site stays under a 2.5 s mobile load.

### 8.1 Recommended stack

| Layer                      | Choice                                                                                                                                              | Why                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                  | **Astro** (static pages, React islands for interactive parts)                                                                                       | Ships near-zero JS by default, content collections for the Journal, built-in client router for page transitions. The portals stay on TanStack Start |
| Shared design              | Import the app's `styles.css` tokens into the site                                                                                                  | One brand across `www`, `clinic.` and `my.`                                                                                                         |
| Scroll and timeline motion | **GSAP** + ScrollTrigger + SplitText (all plugins free for commercial use since GSAP 3.13)                                                          | Industry standard for pinned scroll stories and text reveals ([GSAP free](https://webflow.com/blog/gsap-becomes-free))                              |
| Component motion           | **Motion** (formerly Framer Motion) inside React islands                                                                                            | Springs, layout and shared-element animations for cards, menus, the video theatre                                                                   |
| Smooth scroll              | **Lenis**                                                                                                                                           | Consistent inertial scroll that syncs with ScrollTrigger; disabled under reduced motion                                                             |
| 3D / shaders               | **React Three Fiber** + drei (`MeshTransmissionMaterial` for the serum drop), custom GLSL for ripples and the skin surface                          | Hero and science section only, lazy-loaded                                                                                                          |
| Vector animation           | **Rive** for interactive icons (consent lock, stage dots); Lottie as a fallback                                                                     | Small files, state machines, crisp at any size                                                                                                      |
| Page transitions           | View Transitions API (same-document supported in all major browsers; cross-document in Chromium and Safari, simulated by Astro's router in Firefox) | Native, cheap morphs between pages ([support notes](https://events-3bg.pages.dev/jotter/in-all-major-browsers/))                                    |
| CMS                        | **Sanity** (hosted, free tier) or **Payload** (self-hosted, TypeScript)                                                                             | Journal, videos, creators, reviewers, pages; workflow states for AI draft → clinical review → compliance → published                                |
| Video                      | **Mux** or **Cloudflare Stream**                                                                                                                    | HLS adaptive playback, thumbnails, captions, analytics                                                                                              |
| Forms and leads            | Demo and newsletter forms post to the app's existing `POST /api/insights/events` ingest                                                             | Website leads land in the Insights funnel already built in the clinic portal                                                                        |
| Analytics                  | Cookieless analytics (Plausible or PostHog) by default; marketing pixels only after consent                                                         | PECR and patient trust                                                                                                                              |
| Hosting                    | Cloudflare Pages (free) for `www`; during demos, an ngrok or Cloudflare Tunnel endpoint on the local Astro server (port 4321)                       | Same domain as the portals (Part 1b)                                                                                                                |

### 8.2 Performance budget

| Metric                                       | Target                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Largest Contentful Paint (mobile, 4G)        | ≤ 2.5 s                                                          |
| Interaction to Next Paint                    | ≤ 200 ms                                                         |
| Cumulative Layout Shift                      | ≤ 0.05                                                           |
| Initial JS (excluding lazy hero)             | ≤ 150 KB compressed                                              |
| Hero 3D bundle                               | ≤ 350 KB, loaded after first paint, skipped on low-power devices |
| Lighthouse (performance, accessibility, SEO) | ≥ 90 each                                                        |

Tactics: static HTML first; the hero renders its poster frame or SVG thread immediately and upgrades to WebGL only when `prefers-reduced-motion` is off, Save-Data is off, and the device reports enough memory and cores; AVIF/WebP images with fixed dimensions; fonts subset and preloaded; video posters lazy; animations on transform and opacity only.

### 8.3 Accessibility and motion safety

- WCAG 2.2 AA throughout; glass surfaces keep text contrast at 4.5:1 by darkening the backdrop where needed.
- **Reduced-motion mode** replaces scroll-scrubbed and 3D scenes with static frames and simple fades; Lenis and the cursor light turn off.
- Anything that moves automatically for more than 5 seconds has a pause control (WCAG 2.2.2); nothing flashes more than three times a second.
- Full keyboard paths, visible focus rings, skip link, `aria-live` for form results, captions and transcripts on every video.

### 8.4 SEO and sharing

Static pages with `en-GB` locale, XML sitemaps per section, `Article` / `MedicalWebPage` / `VideoObject` / `Organization` structured data, author and reviewer pages, auto-generated Open Graph images in the brand style, canonical URLs, and `noindex` on the `clinic.` and `my.` hosts.

## Implementation plan, open decisions and sources

The work splits into five stages over about six weeks. Nothing here changes the app code until you approve the plan; the only app-side items are the configuration changes listed in Part 1, 1.4.

### 9.1 Stages

| Stage                         | Scope                                                                                                                                                                         | Output                                    | Rough cost                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| 0. Public demo (days 1–2)     | ngrok account, dev domain, demo-mode tunnel, Vite host allowlist, Supabase redirect URLs                                                                                      | A shareable demo URL                      | $0 (or $10/month Hobbyist to remove the warning page) |
| 1. Pitch (days 2–5)           | Finalise script numbers, rehearse on four pre-opened tabs, record a 2:50 screen film                                                                                          | Live pitch + product film for the website | —                                                     |
| 2. Domain (week 2)            | Trademark check, buy `.com` on Cloudflare, `www` / `clinic` / `my` hosts via ngrok Pay-as-you-go or Cloudflare Tunnel, email DNS (SPF, DKIM, DMARC)                           | Branded URLs for site and portals         | ~$10/year domain + $0–$42/month tunnel                |
| 3. Website v1 (weeks 2–5)     | Astro site, design tokens, home scroll story with hero concept B (fallback C), two doors, sign-in page, clinic module pages, pricing, compliance and trust pages, legal pages | Launchable `www`                          | Mux/Stream from ~$0–$20/month; CMS free tier          |
| 4. Content engine (weeks 4–6) | CMS workflow (AI draft → clinical review → compliance → publish), advisory board reviewers, first 12 articles, Watch hub with first creator videos                            | Journal and Watch live, weekly cadence    | Clinician review time; creator fees                   |

### 9.2 Decisions needed from you

1. **Website audience weighting:** patient-first brand with a clinic section (as designed), or clinic-first B2B site with a patient area?
2. **Tunnel choice for the branded domain:** ngrok Pay-as-you-go (~$42/month) or Cloudflare Tunnel (free)?
3. **Domain name and TLD:** confirm the `.com` target after the trademark check.
4. **Hero concept:** B (serum drop, recommended), A (living skin) or C (journey thread).
5. **CMS:** Sanity (hosted) or Payload (self-hosted).
6. **Clinical advisory board:** who signs off articles (name and registration number needed on every clinical piece).
7. **Pitch numbers:** raise amount, pilot clinic count, any traction figures you are comfortable sharing.
8. **Next step:** an interactive motion prototype of the home page as a standalone artifact (no changes to the app repo) before the full build.

### 9.3 Sources

**ngrok, domains, hosting:** [ngrok pricing](https://ngrok.com/pricing) · [ngrok free plan limits](https://ngrok.com/docs/pricing-limits/free-plan-limits) · [ngrok dev domains](https://ngrok.com/blog/free-static-domains-ngrok-users) · [ngrok custom domains](https://ngrok.com/docs/guides/other-guides/how-to-set-up-a-custom-domain/) · [ngrok agent config v3](https://ngrok.com/docs/agent/config/v3) · [Vite host-check advisory](https://osv.dev/vulnerability/GHSA-vg6x-rcgg-rjx6) · [Cloudflare Tunnel DNS](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/) · [Cloudflare Registrar prices (TLDSpy)](https://tldspy.com/registrar/cloudflare) · [Tunnel comparison 2026](https://ondelva.com/blog/2026/04/tailscale-vs-cloudflare-tunnel-vs-ngrok-2026)

**Market and competitors:** [UK aesthetics statistics (PolicyBee)](https://www.policybee.co.uk/blog/aesthetics-industry-statistics) · [Medical spa software market (GMI)](https://www.gminsights.com/industry-analysis/medical-spa-management-software-market) · [Licensing consultation outcome (CMS)](https://cms.law/en/gbr/legal-updates/regulating-beauty-what-the-government-s-consultation-means-for-non-surgical-procedures) · [Pabau vs Aesthetic Record pricing](https://pabau.com/blog/aesthetic-record-pricing/) · [UK clinic software comparison (Calyx)](https://www.usecalyx.app/blog/aesthetic-clinic-software-comparison-uk-2026) · [Clinic software 2026 (Nextmotion)](https://www.nextmotion.net/blog/best-aesthetic-clinic-software-2026)

**Website, content, rules:** [Medspa conversion statistics (Web Tonic)](https://www.webtonic.io/blog/medical-spa-landing-page-statistics) · [Medspa sites in 2026 (Unicorn Platform)](https://unicornplatform.com/blog/med-spa-websites-in-2026/) · [Truekind on Awwwards](https://www.awwwards.com/sites/truekind-skincare) · [Koba on Awwwards](https://www.awwwards.com/sites/koba-skincare) · [UK search trends](https://thebusinessjournal.co.uk/business-insights/the-changing-face-of-aesthetics-what-search-data-suggests-about-the-uks-beauty-market/) · [UK aesthetic trends 2026 (Meridiq)](https://meridiq.com/en/aesthetic-trends/uk-aesthetic-trends-2026/) · [ASA/CAP botulinum toxin guidance](https://www.asa.org.uk/advice-online/beauty-and-cosmetics-botulinum-toxin-products.html) · [ASA enforcement notice](https://www.asa.org.uk/resource/enforcement-notice-botox-social-media.html) · [ASA on beauty filters](https://www.asa.org.uk/news/the-mis-use-of-social-media-beauty-filters-when-advertising-cosmetic-products.html) · [Google on AI content](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content) · [GSAP free](https://webflow.com/blog/gsap-becomes-free) · [View Transitions support](https://events-3bg.pages.dev/jotter/in-all-major-browsers/)

Figures from secondary roundups (market size, practitioner counts, conversion benchmarks) should be checked against their primary sources before appearing in investor materials.
