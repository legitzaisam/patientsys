---
name: Phase 6 identity authentication
overview: "Close public signup, add self-service password reset, split staff and patient auth surfaces, move OAuth to native Supabase (Google + Microsoft), add login throttle, idle logout, step-up for destructive actions, and TOTP MFA for owner/manager."
todos:
  - id: p6-plan
    content: Write docs/plans/phase-06-identity-authentication.md from the live auth surface
    status: completed
  - id: p6-signup-reset
    content: Close /auth signup, add forgot-password + /auth/reset for staff and patients
    status: completed
  - id: p6-surfaces
    content: Refuse the wrong audience after login; redirect patients off staff routes; landing portal link
    status: completed
  - id: p6-oauth
    content: Native Google/Microsoft OAuth via /auth/callback; stop importing the Lovable wrapper
    status: completed
  - id: p6-session
    content: Login throttle RPCs, 15-minute staff idle logout, session revoke, step-up on archive/revoke/permissions
    status: completed
  - id: p6-mfa
    content: TOTP gate for owner/manager; Security card on /profile
    status: completed
  - id: p6-dashboard
    content: "You apply in Supabase: disable signups, SMTP, redirect URLs, TOTP, Google/Azure, then apply 20260910000000"
    status: pending
isProject: false
---

See [docs/plans/phase-06-identity-authentication.md](../../docs/plans/phase-06-identity-authentication.md).
