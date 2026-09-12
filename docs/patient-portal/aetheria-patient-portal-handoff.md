# Handoff Spec: Aetheria Patient Portal

**Source:** `aetheria-patient-portal-wireframes.html` (26 screens, v0.1)
**Spec:** `aetheria-patient-portal-spec.md` v0.1 — DRAFT, not frozen
**Target stack:** React 19, TypeScript, Tailwind CSS 4, TanStack Start + Router, shadcn-style primitives in `src/components/ui`

> These wireframes are mid-fidelity and deliberately off-brand. Greyscale plus one teal is there so the client reviews structure, not colour. Visual design has not happened — the token table below is a wireframe palette, not the Aetheria brand palette, and §2 says what to replace it with.

---

## 1. Overview

The patient-facing half of Aetheria. A patient signs in, sees what needs doing, books or changes visits, completes intake and consent, reads their record, messages the clinic, and pays.

Primary context: a phone, one-handed, often in a waiting room or on a train, sometimes anxious about a cosmetic outcome. Mobile is the design target and desktop is the adaptation, not the other way round.

**Existing code this replaces:** the single `/my-record` route. Everything else in `_authenticated` is staff and untouched.

---

## 2. Design tokens

### Wireframe palette (replace at visual design)

| Token | Value | Usage |
|---|---|---|
| `--paper` | `#FBFBF9` | Screen background |
| `--ink` | `#1C1F26` | Primary text |
| `--graphite` | `#5A6069` | Secondary text, body copy in cards |
| `--mute` | `#8A9099` | Tertiary text, placeholders, timestamps |
| `--rule` | `#DCDDD8` | Hairlines, card borders, dividers |
| `--fill` / `--fill2` | `#ECEDE8` / `#E2E4DE` | Placeholder blocks, inactive chips |
| `--act` | `#1F5F57` | Primary action, active nav, confirmed state |
| `--act-soft` / `--act-line` | `#E4EFEC` / `#B9D4CE` | Positive banner fill and border |
| `--warn` | `#8A5A00` | Needs-attention: consent due, deposit unpaid, requested |
| `--warn-soft` / `--warn-line` | `#FBF1DE` / `#E8D5A8` | Warning banner fill and border |
| `--stop` | `#8C2A22` | Destructive and clinical-urgency only |
| `--stop-soft` / `--stop-line` | `#FAEAE8` / `#E7C4BF` | Destructive banner fill and border |

**At visual design, map to the real product tokens.** The clinic app already defines `--accent`, `--accent-hi`, `--accent-ink`, `--accent-soft`, `--edge`, `--edge-2`, `--glass-2`, `--ink-2`, `--ink-3`, `--lane-*` and `--shadow-bloom` in `src/styles.css`. The portal should share that system so a patient and a clinician are visibly in the same product. Do not fork a second palette.

**Semantic rule that must survive redesign:** three states, three colours, never reused for anything else.
- Teal — done, confirmed, safe to proceed
- Amber — needs the patient to act, or is not yet confirmed
- Red — destructive, or clinically urgent

Nothing decorative may use red. A patient scanning for the thing that matters must be able to trust it.

### Type

| Role | Face | Size / weight / tracking |
|---|---|---|
| Page title | Space Grotesk | 19px / 600 / −0.015em mobile; 24px desktop |
| Card title | Space Grotesk | 15px / 600 / −0.01em |
| Body | Space Grotesk | 13–14px / 400 / normal, 1.5 line-height |
| Small | Space Grotesk | 12–12.5px / 400 |
| Tiny (meta, timestamps) | Space Grotesk | 11px / 400, `--mute` |
| Section label | Space Grotesk | 12px / 600, `--mute` |
| Money (large) | Space Grotesk | 26px / 700 / −0.02em, tabular |

Space Grotesk is already loaded in `__root.tsx`. One family throughout. Body copy stays under 80 characters — on the 390px frame that is roughly 42, which is why cards are the layout unit rather than full-width paragraphs.

### Spacing and radius

4px base. Card padding 14px, screen gutter 16–18px mobile / 22–28px desktop, card gap 12px, section gap 22px.

Radius is hierarchical, not uniform: 20px pills (chips), 12px cards and lists, 10px buttons and banners, 9px inputs and slots, 8px placeholder blocks. Do not collapse these to one value.

---

## 3. Layout and breakpoints

| Breakpoint | Navigation | Content |
|---|---|---|
| < 768px | Bottom tab bar, 5 items, fixed | Single column, full width minus 16px gutters |
| ≥ 768px | Left sidebar 212px, two groups | Single column capped at 620px, left-aligned |

**Content stays one column at every width.** The clinic app is a dense multi-pane tool; the portal is not. Widening to two columns on desktop would push the primary action below the fold on a 13-inch laptop for no gain.

The 768px breakpoint matches `src/hooks/use-mobile.tsx`, which already exists. `src/components/ui/sidebar.tsx` already implements a mobile `Sheet` drawer at lines 189–210. **Both are currently unimported by `app-shell.tsx`** — that omission is why the staff app clips at 390px (audit §8.4) and the portal shell must not repeat it.

**Bottom tabs, not a hamburger.** Five destinations, thumb-reachable, always visible. A patient who cannot find "Forms" does not sign consent, and the visit is wasted.

---

## 4. Components

| Component | Variants | Props | Notes |
|---|---|---|---|
| `PortalShell` | mobile, desktop | `children`, `activeTab`, `title`, `backTo?` | Chooses tab bar or sidebar off `useIsMobile()`. Renders skip link as first focusable element. |
| `ActionCard` | default, warn, positive | `title`, `meta`, `chip?`, `to` | Whole card is the hit target, min-height 44px. Used in Home "Needs you". |
| `Chip` | default, act, warn, stop | `children` | Status only. Never a button — if it is tappable it is a `Button`. |
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
| Action card | hover (pointer only) | Background `#FAFAF8`. No transform, no shadow change. |
| Action card | active | Background `--fill`, no scale animation. |
| Primary button | loading | Label swaps to present continuous ("Signing…"), spinner, disabled. Width does not change. |
| Primary button | disabled | 40% opacity, `cursor:not-allowed`, and **an adjacent line saying why**. A disabled button with no reason generates a phone call. |
| Slot | unavailable | Struck through, `--fill`, `aria-disabled`. Reason in the banner below the grid. |
| Slot | selected | `--act` fill, white text, `aria-pressed="true"`. |
| Form field | autosaving | "Saving…" then "Saved just now" in `--act`, top right. Never a toast — toasts on every keystroke are noise. |
| Form field | error | `--stop` border, `--stop-soft` fill, message below, `aria-describedby`. Inline, not a toast. |
| Consent signature | submitted | Full-screen confirmation, not a toast. This is the highest-consequence action in the product. |
| Message | sending | Bubble at 60% opacity until the server confirms. |
| Message | failed | Retry affordance on the bubble. Never silently drop. |
| Photo tile | tap | Reveal with a 150ms fade. Second tap re-blurs. |
| Destructive button | tap | Always opens a confirm sheet. Never acts directly. |

---

## 6. Responsive behaviour

| Breakpoint | Changes |
|---|---|
| Desktop ≥ 768px | Sidebar nav; page title moves into content, not a header bar; content capped 620px; confirm sheets become centred modals 440px |
| Mobile < 768px | Bottom tabs; sticky header with back chevron; confirm sheets slide up from the bottom; slot grid 3 columns |
| < 360px | Slot grid drops to 2 columns; tab labels shrink to 10px; **never clips — overflow scrolls** |

The last point is the load-bearing one. At 390px today the staff layout has `scrollWidth === innerWidth` while content sits outside the viewport, so it is unreachable by any gesture. Every portal container needs an explicit overflow strategy.

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

**Focus order.** Skip link → header → back → main → primary action → nav. The skip link is the first focusable element on every route; there is currently no skip link anywhere in the app (audit §9.2).

**Targets.** 44×44px minimum for everything interactive, including tab bar items and slot buttons.

**Contrast.** All pairs above verified at 4.5:1 for text and 3:1 for borders and icons. Re-verify after the brand palette swap — the accent teal is doing real work and a lighter brand accent may fail.

**ARIA.**
- Tab bar: `<nav>` + `aria-current="page"`
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
