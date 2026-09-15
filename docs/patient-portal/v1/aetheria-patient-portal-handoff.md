# Handoff Spec: Aetheria Patient Portal

**Source:** `aetheria-patient-portal-wireframes.html` (26 screens, v0.4)
**Spec:** `aetheria-patient-portal-spec.md` v0.1 — DRAFT, not frozen
**Target stack:** React 19, TypeScript, Tailwind CSS 4, TanStack Start + Router, shadcn-style primitives in `src/components/ui`

> v0.4 is a full-bleed clone of the clinic AppShell: collapsible/resizable sidebar, sticky overlay toolbar, no solid top bar. Tokens, type, glass cards and buttons come from `src/styles.css` and `src/components/app-shell.tsx`.

---

## 1. Overview

The patient-facing half of Aetheria. A patient signs in, sees what needs doing, books or changes visits, completes intake and consent, reads their record, messages the clinic, and pays.

Primary context: a phone, one-handed, often in a waiting room or on a train, sometimes anxious about a cosmetic outcome. The shell is the clinic AppShell at every width — sidebar + sticky toolbar — so the product is one system. Mobile collapses the sidebar; it does not invent a second navigation model.

**Existing code this replaces:** the single `/my-record` route. Everything else in `_authenticated` is staff and untouched.

---

## 2. Design tokens

Use the clinic tokens in `src/styles.css` — Bright Pastels, Notebook Lines. Do not fork a second palette.

| Token | Value | Usage |
|---|---|---|
| `--background` | `#f6f7f8` | Page wash; notebook rules + yellow/peach radial blooms sit on top |
| `--foreground` / `--ink-2` / `--ink-3` | `#2f3f66` / `#46557a` / `#6a7390` | Primary, secondary, tertiary type |
| `--glass` / `--glass-2` / `--edge` | white 82% / 62% / 70% | Cards, wells, hairlines |
| `--accent` / `--accent-hi` / `--accent-ink` | `#eed488` / `#faedc2` / `#7a6220` | Primary action, active nav tile, confirmed gold |
| `--success` / `--success-ink` | `#4a9d75` / `#2d6a4c` | Done, confirmed, safe to proceed |
| `--consent` / `--consent-ink` | `#b9a6e8` / `#5c4a94` | Needs the patient to act (consent, deposit, requested) |
| `--destructive` / `--destructive-ink` | `#dc6c96` / `#a3456e` | Destructive or clinically urgent only |
| `--sky` / `--sky-ink` | `#8fc7ea` / `#3d6f96` | Informational banners |

**Semantic rule:** three states, three colours, never reused for anything else.
- Green — done, confirmed, safe to proceed
- Lilac — needs the patient to act, or is not yet confirmed
- Rose — destructive, or clinically urgent

Nothing decorative may use rose. A patient scanning for the thing that matters must be able to trust it.

### Type

| Role | Face | Size / weight / tracking |
|---|---|---|
| Page title | Space Grotesk | 22px / 600 / −0.016em (`.page-title`) |
| Page subtitle | Space Grotesk | 14px / 400, `--ink-2` (`.page-subtitle`) |
| Section title | Space Grotesk | 17px / 600 / −0.016em (`.section-title`) |
| Card title | Space Grotesk | 15px / 600 / −0.012em |
| Body | Space Grotesk | 13.5px / 400 / 1.5 |
| Small | Space Grotesk | 12–12.5px / 400 |
| Tiny (meta, timestamps) | Space Grotesk | 11px / 400, `--ink-3` |
| Money (large) | Space Grotesk | 27px / 600 / −0.02em, tabular |

Space Grotesk is already loaded in `__root.tsx`. One family throughout. Reuse `.page-header`, `.page-title`, `.page-subtitle` and `.section-title` from the clinic stylesheet — do not invent a second type ramp.

### Spacing and radius

Clinic values. Card padding 18px on KPI-style surfaces, 15px on list cards; screen gutter 16px mobile / 26px desktop; section gap 24px.

Radius is hierarchical and already in the theme: 22px `glass-card`, 11px nav rows and inputs, 9px brand mark, full pills for chips and buttons. Do not collapse these to one value.

---

## 3. Layout and breakpoints

Reuse `AppShell`. Do not build a second patient chrome.

| Breakpoint | Navigation | Content |
|---|---|---|
| < 768px | Same shell, sidebar closed; panel-left opens it as a sheet | Single column, 16px gutters |
| ≥ 768px | 238px glass sidebar, three groups (Care / You / Account) | Content in `max-w-[1400px]`, two columns only where the clinic dashboard already splits |

**The toolbar is sticky and overlaying, not a solid header bar.** Messages (unread chip) and the account pill (avatar, name, "Patient") sit on the right, matching staff notifications + account menu.

**Page titles live in the canvas** as `.page-header` / `.page-title` / `.page-subtitle`, not in a mobile app bar.

The 768px breakpoint matches `src/hooks/use-mobile.tsx`. Sidebar collapse and width persistence already exist on the staff shell (`aetheria.sidebar`, `[` shortcut). The portal uses the same behaviour.

---

## 4. Components

| Component | Variants | Props | Notes |
|---|---|---|---|
| `PortalShell` | mobile, desktop | `children`, `activeNav`, `title`, `subtitle?`, `backTo?` | The clinic `AppShell` with patient nav groups. Sidebar sheet on small screens. Skip link first. |
| `ActionCard` | default, warn, positive | `title`, `meta`, `chip?`, `to` | Whole card is the hit target, min-height 44px. Used in Home "Needs you". |
| `Chip` | default, gold, success, consent, stop, sky | `children` | Status only. Never a button — if it is tappable it is a `Button`. |
| `Banner` | info, warn, stop | `children`, `dismissible?` | Clinical-safety banners are never dismissible. |
| `Button` | primary, secondary, ghost, danger; sizes default/sm | standard | Default min-height 44px; `sm` 36px and only where not the primary action. |
| `Field` | text, textarea, choice, date-parts | `label`, `hint?`, `error?` | Label always visible. No placeholder-as-label. |
| `SlotGrid` | — | `slots[]`, `selected`, `onSelect` | Unavailable slots render disabled **with a reason**, never removed. |
| `Stepper` | — | `total`, `current` | Progress bars for booking and multi-section forms. |
| `Timeline` | — | `nodes[]` with `done \| now \| future` | Appointment progress and cooling-off countdown. |
| `KeyValue` | — | `rows[]` | Right-aligned values, hairline between. |
| `Thread` / `Bubble` | them, me | `messages[]` | Reuse `PatientChatPanel` logic; new presentation. |
| `PhotoTile` | blurred, revealed | `url`, `kind`, `caption?` | Blur is the default. Reveal is per-tile and does not persist across sessions. |
| `CompareSlider` | — | `before`, `after` | Must be keyboard-operable — arrow keys move the divider. |
| `DiffPreview` | — | `from`, `to` | Health updates. Additions and removals both marked, never colour alone. |

---

## 5. States and interactions

| Element | State | Behaviour |
|---|---|---|
| Action card | hover (pointer only) | `--shadow-lift`, border to `--edge-2`. No scale. |
| Action card | active | `rgba(47,63,102,.14)` wash, no scale animation. |
| Primary button | loading | Label swaps to present continuous ("Signing…"), spinner, disabled. Width does not change. |
| Primary button | disabled | 40% opacity, `cursor:not-allowed`, and **an adjacent line saying why**. A disabled button with no reason generates a phone call. |
| Slot | unavailable | Struck through, `--fill`, `aria-disabled`. Reason in the banner below the grid. |
| Slot | selected | Accent gradient fill, `aria-pressed="true"`. |
| Form field | autosaving | "Saving…" then "Saved just now" in `--accent-ink`, top right. Never a toast — toasts on every keystroke are noise. |
| Form field | error | Destructive border and fill, message below, `aria-describedby`. Inline, not a toast. |
| Consent signature | submitted | Full-screen confirmation, not a toast. This is the highest-consequence action in the product. |
| Message | sending | Bubble at 60% opacity until the server confirms. |
| Message | failed | Retry affordance on the bubble. Never silently drop. |
| Photo tile | tap | Reveal with a 150ms fade. Second tap re-blurs. |
| Destructive button | tap | Always opens a confirm sheet. Never acts directly. |

---

## 6. Responsive behaviour

| Breakpoint | Changes |
|---|---|
| Desktop ≥ 768px | Sidebar open; page title in the canvas; content `max-w-[1400px]`; confirm sheets become centred modals 440px |
| Mobile < 768px | Sidebar closed; panel-left opens a sheet; back chevron in the page header; confirm sheets slide up; slot grid 3 columns |
| < 360px | Slot grid drops to 2 columns; **never clips — overflow scrolls** |

The last point is the load-bearing one. At 390px today the staff layout has `scrollWidth === innerWidth` while content sits outside the viewport, so it is unreachable by any gesture. The portal shell must not repeat that. Every container needs an explicit overflow strategy.

---

## 7. Edge cases

- **Empty.** Every list has a designed empty state naming what will fill it plus one action. See `home-empty` in the prototype.
- **Long text.** Treatment names truncate at 2 lines with `text-overflow: ellipsis`; practitioner names at 1. Full value in `title`. Never truncate a monetary amount, a date, or a consent clause.
- **Loading.** Skeletons matching final layout, not spinners — the home screen has known structure. Spinners only for indeterminate actions like payment.
- **Error.** Named cause plus a retry plus a phone number. Never fabricated zeros (audit §8.5).
- **Denied.** A patient hitting a staff route gets a shell with navigation and an explanation, not a bare "Staff access only." string with no way back.
- **Offline.** Aftercare documents are cached and readable offline. Everything else shows an offline banner with retry.
- **No linked record.** The current dead end (audit §8.3) becomes an explained pending state with a contact route.
- **Slot taken mid-flow.** "That time has just gone" plus the three nearest alternatives. Never a generic failure.
- **Session expiry mid-form.** Draft is already autosaved server-side; on re-auth the patient returns to the same section.

---

## 8. Motion

One orchestrated moment per screen at most. No entrance animation on cards or sections.

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Confirm sheet | open | Slide up from bottom | 220ms | `cubic-bezier(.2,.8,.2,1)` |
| Confirm sheet | dismiss | Slide down | 160ms | `ease-in` |
| Photo tile | tap | Blur 6px → 0, opacity | 150ms | `ease-out` |
| Autosave label | save completes | Cross-fade | 120ms | `linear` |
| Tab change | tap | None | — | — |
| Timeline node | reaches `now` | Ring pulse, once | 400ms | `ease-out` |

All of it gated behind `prefers-reduced-motion: reduce`, which disables everything above except opacity fades.

---

## 9. Accessibility — WCAG 2.2 AA

**Focus order.** Skip link → sidebar toggle → account → main → primary action. The skip link is the first focusable element on every route; there is currently no skip link anywhere in the app (audit §9.2).

**Targets.** Match the clinic `Button` (36px default, 32px `sm`). WCAG 2.2 AA is 24px; do not invent a larger patient-only target.

**Contrast.** All pairs above verified at 4.5:1 for text and 3:1 for borders and icons. Accent butter on `--accent-foreground` is the clinic pairing — keep it.

**ARIA.**
- Sidebar: `<nav>` + `aria-current="page"` on the active item
- Chips: no role, plain text — they are not controls
- Slots: `<button aria-pressed>` with `aria-disabled` and `aria-describedby` pointing at the reason banner
- Autosave: `aria-live="polite"`
- Errors: `aria-live="assertive"` plus `aria-describedby` on the field
- Confirm sheet: `role="dialog" aria-modal="true"`, focus trapped, Escape closes, focus returns to the trigger
- Compare slider: `role="slider"` with `aria-valuenow`, arrow keys move it
- Blurred photo: `aria-label` says it is hidden and how to reveal it

**Screen reader announcements.** Route change announces the page title. Autosave announces "Saved". Form errors announce the count and the first error. Signature success announces the full confirmation including the cooling-off date — that is information the patient needs, not decoration.

**Keyboard.** Every flow completable without a pointer, including booking and the compare slider.

---

## 10. Per-screen notes worth carrying into build

**Home.** One `getPortalHome` call. LCP under 2.0s on 4G. "Needs you" renders only when non-empty — no orphan heading.

**Appointment detail.** Three-state progress, not the seven-value `visit_stage` enum. Cancellation deadline is a computed date and time for this appointment, not abstract policy text.

**Booking, slot step.** Cooling-off-blocked slots are disabled and explained. Slot held 30 minutes via `appointment_holds` with a partial unique index — two patients will race.

**Consent.** Stage 1 discussion summary renders above the form. A consent document with no `consent_discussions` row cannot be sent. On signature capture ip, user agent, timestamp and a version hash of the exact text signed.

**Signed.** Cooling-off timeline plus a visible withdraw action. Withdrawal must be as easy as consenting.

**Photos.** Blur default. Signed URLs 3600s, never logged. Per-photo marketing consent withdrawal.

**Health.** Diff before submit, partial submission, per-section review status. Non-dismissible urgent-contact line.

**Payments.** `/my-record?pay=X&kind=Y` must 301 to `/payments?appointment=X&kind=Y` with params preserved — those links are already in patients' inboxes.

---

## 11. Blockers on this handoff

Visual design can start on structure now. These block **build**, and three of them block finalising the screens:

1. **The client's brainstormed patient flow** — still not received. §6 of the spec is my proposal in its absence.
2. **D-01 booking model** — request, direct, or hybrid. The prototype assumes hybrid. Changing it rewrites four screens.
3. **D-02 availability source** — there is no working-hours table and no calendar integration, so `getAvailableSlots` cannot be built at all yet.
4. **D-11 payment processor** — the payments screen is entirely blocked.
5. **D-15 family or proxy access** — a genuine auth-model change, not a UI one. `patients.user_id` is UNIQUE, so this cannot be retrofitted cheaply. Answer it before build, not after.
