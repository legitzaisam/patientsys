# Phase 6 — Identity and authentication hardening

**Parent:** Aetheria Remediation Master Plan, Phase 6
**Depends on:** Phase 0 (complete). Independent of the comms outbox — Supabase Auth sends its own mail.
**Blocks:** Phase 10 (portal invitations assume a working reset and a closed signup)
**Risk:** high. A mistake here locks the owner out of the clinic, or lets a patient session into staff chrome. MFA enforcement is on by default for owner and manager the moment this ships.

## Why this is next

Authorization (Phases 1–3) and the database (Phase 5) now refuse the wrong *person*. Authentication still lets the wrong *account* in, and gives a locked-out receptionist no way back in:

- There is no "Forgot password?" anywhere in `src`. Audit §8.2, still CRITICAL.
- `/auth` still has an open signup. Anyone can create an unusable account. Audit §8.3.
- Staff and patients share one Auth project and patients can type staff URLs (Phase 2 finding 14.3.1).
- Google sign-in goes through `@lovable.dev/cloud-auth-js`, a vendor in the authentication path.
- Owner and manager have no MFA. For special-category health data that is the larger real-world risk.

## What research changed

**§4.1 does not belong here.** Phase 5 parked "move off the service-role client" on this phase. The session middleware exists *because* user access tokens are ES256 and PostgREST rejects them (`PGRST303`). Switching the handler client to the caller's JWT would take every server function down. That is a dedicated spike, not a side-effect of reset and MFA. Deferred, with the reason.

**OAuth: native Supabase, not the Lovable wrapper.** The wrapper is two call sites and an auto-generated file. Native `signInWithOAuth` is what lets us control the redirect and pair it with the surface check. The generated `integrations/lovable/index.ts` is left untouched so a Lovable regeneration does not fight us; nothing imports it after this phase.

**SAML is out of scope.** `supabase/config.toml` has no SSO config and we have no evidence of a Pro plan. Recorded, not built.

**MFA is enforced for owner and manager, optional for everyone else.** Matches the master plan. `identity.isManager` already means owner-or-manager.

**Domain restriction is the surface check, not a domain allowlist.** A Gmail owner would be locked out of Google sign-in by a clinic-domain rule. After any staff-surface login, `getMe` must report `isStaff` or we sign the session out. Combined with closed signup, a random Google account cannot enter the staff app. That is the control.

**Login throttle cannot go through `clinic.functions.ts`.** Failed sign-ins have no JWT, and every handler requires one. Two `SECURITY DEFINER` RPCs callable by `anon` write only to their own table.

**Session listing is not in supabase-js 2.112.** "Sign out other devices" / "sign out everywhere" are, via `signOut({ scope })`. The profile page offers those plus the current session; a full device list waits on a GoTrue upgrade.

## Dashboard steps that code cannot do

These have to be done in the Supabase project (Settings → Authentication) for the flows to deliver mail and to actually refuse new signups. The app degrades honestly if they are not done: reset shows "check your email" and native Google fails with the provider error.

1. **Disable "Allow new users to sign up."** Closes email *and* OAuth account creation. Existing users still sign in.
2. **Enable automatic linking** of identities that share an email, so an invited staff member can use Google/Microsoft on the same address.
3. **Redirect URLs:** `http://localhost:8080/auth/callback`, `http://localhost:8080/auth/reset`, the production equivalents, and `/portal`.
4. **SMTP** on the clinic domain. Until that is set, reset mail uses Supabase's default sender and will often land in spam. This is the one item that unblocks reset without waiting for Phases 7–9.
5. **Google provider** (already used via Lovable — confirm it is enabled on *this* project's Auth providers, not only Lovable's).
6. **Azure (Microsoft) provider** — until this is on, the Microsoft button toasts the provider error.

## Task groups

### A — Close the holes (Tier 0)

**A1. Close public signup.** Remove the signup mode from [src/routes/auth.tsx](../../src/routes/auth.tsx). Staff are invited; patients are told on `/portal` that the clinic creates their account. Keep the `getMe` first-owner bootstrap — it is the only way a brand-new project gets an owner, and with the UI closed it is reachable only by creating a user in the dashboard.

**A2. Self-service reset.** `resetPasswordForEmail` from both `/auth` and `/portal`, plus `/auth/reset` which handles the recovery session and `updateUser({ password })`. Copy never confirms that the address exists.

**A3. Separate the surfaces.** After password or OAuth on `/auth`, if `getMe` is not staff, sign out and point at `/portal`. After `/portal`, staff without a patient record go to `/dashboard`. Authenticated layout: a patient hitting any path other than `/my-record` is redirected there. Closes 14.3.1. Landing page gains a Patient portal link so `/portal` is discoverable (audit 8.1).

### B — Native OAuth

**B1.** `src/lib/auth/oauth.ts` — `signInWithOAuth` for `google` and `azure`, redirect `/auth/callback`, remember the surface in `sessionStorage`.

**B2.** `/auth/callback` exchanges the PKCE code, reads the surface, runs the same identity check as password login.

**B3.** Microsoft button next to Google on both login pages. Stop importing `@/integrations/lovable`.

### C — Session hygiene

**C1. Login throttle.** Migration `20260910000000_auth_login_throttle.sql`: `auth_login_events`, `check_login_throttle(email, surface)`, `record_login_event(email, surface, success)`. 5 failures in 15 minutes locks 15 minutes. Success deletes the recent failures. Tables are unscoped (no `clinic_id` — the caller has no clinic yet).

**C2. Idle logout.** 15 minutes without pointer/key/scroll on a staff session, then hard-navigate to `/auth?idle=1`. Patients are not timed out (personal devices). Demo mode skips this.

**C3. Sessions on `/profile`.** Current session, "Sign out other devices", "Sign out everywhere".

**C4. Step-up.** `confirmStepUp({ password })` writes `auth_step_up` (5-minute TTL). `requireStepUp()` is called from `archivePatient`, `revokeStaffAccess`, `setRolePermission`. The UI prompts for the password when the server refuses.

### D — TOTP MFA

**D1.** `readIdentity` gains `aal`, `mfaEnrolled`, `mfaRequired` (`isOwner || manager role`).

**D2.** `authorize()` refuses every handler except `getMe` when `mfaRequired` and (not enrolled or `aal !== 'aal2'`). Enrolment is client-side `supabase.auth.mfa.*`, so the gate can complete without a handler.

**D3.** `MfaGate` in the authenticated layout, after the password-change gate: enrol with QR + 6-digit code, or challenge if already enrolled.

**D4.** Profile "Security" card: optional enrol/unenroll for practitioners and front desk; owner/manager cannot leave themselves with zero factors.

## Verification

1. `npx tsc --noEmit` no worse than the 52-error baseline.
2. `npm run check:policy`, `check:validators`, `check:tenancy` green.
3. `/auth` has no "Sign up". Submitting a new email/password there does not create an account.
4. Forgot-password on staff and portal: toast does not confirm the address; `/auth/reset` accepts a recovery session and updates the password.
5. Patient session on `/auth` is refused; staff session on `/portal` lands on `/dashboard`; patient typing `/retention` lands on `/my-record`.
6. Google/Microsoft buttons call native `signInWithOAuth` (network tab), not `cloud-auth-js`.
7. Five failed staff logins lock the next attempt; a success clears it.
8. Owner with no TOTP is gated on first load and cannot call `getDashboard` until verified; after verify, AAL2 and the gate is gone.
9. Archiving a patient, revoking staff, and flipping a permission each demand a password if step-up is cold.
10. 15 minutes idle as staff → `/auth?idle=1`. Patient idle does not.
11. Demo sweep: no MFA gate, no idle logout, login still works.

## Commits

Split along revert lines:

1. `feat: close public signup and add self-service password reset`
2. `feat: native Google/Microsoft OAuth and staff/patient surface split`
3. `feat: login throttle, idle logout, session revoke and step-up auth`
4. `feat: enforce TOTP MFA for owner and manager`
5. `docs: Phase 6 identity and authentication plan and work log`

## Rollback

Commits 1–4 revert independently. The migration does not: dropping the RPCs is safe (the app falls open on throttle, which is the previous behaviour) but a revert of MFA enforcement while owners have TOTP enrolled still works — they just are not asked. The dangerous rollback is re-enabling signup in the dashboard.

## Out of scope

- §4.1 service-role / ES256 (own spike).
- SAML SSO (needs Pro).
- Portal invitations linking `patients.user_id` (Phase 10).
- Real email/SMS of anything except Auth's own mail (Phases 7–9).
- Per-clinic idle timeout setting (constant, 15 minutes).
- Full session device list (GoTrue endpoint not in supabase-js 2.112).

## On completion

Append the work log, tick `phase-6` in the master plan, confirm Phase 7 preconditions.
