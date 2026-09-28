# Phase 3: team.manage_profiles and team.commission keys; policy moves

Branch `e2e_live`, on top of `52e43e1`. 28 Sep 2026.

### p3-01-keys

- `src/lib/permissions.ts`: `team.manage_profiles` ("Edit staff profiles" — open a colleague's full profile, edit details, working pattern and bookable treatments, approve time off; without it a manager sees the front-desk view) and `team.commission` ("Set staff commission" — see and set the rate, open their Performance & earnings; needs Edit staff profiles as well). `PERMISSION_META` gains an optional `managerOnly` flag, set on both; both join the Team group after `team.approve_changes`.
- Checked: `permissions.test.ts` (every key has META), `access-catalogue.test.ts` pass.

### p3-02-grid

- `src/components/access-control-settings.tsx`: for a `managerOnly` key the Receptionist and Practitioner cells render a dash (`data-qc="grant-manager-only"`, `aria-label="Manager only"`, title "… is for managers only") instead of a switch; the Manager switch and any named pack keep the switch. Nothing else on the grid moves.
- Checked: owner's Team page — "Edit staff profiles" and "Set staff commission" rows show 2 dashes + 1 switch (on) each; `captures/p3-grid-manager-only.png`.

### p3-03-seed-migration

- `supabase/migrations/20261001000100_team_profile_keys.sql`: seeds both keys for every clinic (manager true; practitioner and front_desk false) with `ON CONFLICT DO NOTHING`, same shape as `20260929000400`.
- `src/lib/demo/data.ts`: the six matching `rolePermissions` rows.

### p3-04-policy

- `src/lib/staff-access.ts` (new, pure): `canManageProfiles(identity)` = owner or admin, or the manager role holding `team.manage_profiles`; `canSetCommission(identity)` additionally needs `team.commission`; `colleagueView(identity)` → `"manage" | "frontdesk"`. Used by the server (both twins) and, from P6, the UI.
- `src/lib/auth/policy.ts`: new `Access` kind `{ kind: "managerCapability"; key }` (owner or admin, or the manager role holding the key — a named pack cannot lift another role into it); `updateStaffMember` → `managerCapability team.manage_profiles`; `setCommissionRate` → `managerCapability team.commission`.
- `src/lib/auth/guards.server.ts`: `requireManagerCapability(context, key)` and the `authorize` switch case. Demo: `requireManagerCapability(key)` beside `requireManager`, used by `updateStaffMember` and `setCommissionRate`.

### p3-05-existing-fns

- Other-person branches now go through the helpers in production and demo: `getMyEarnings(userId)` needs `canSetCommission`; `listMyDocuments(targetUserId)` and `setMyAvatar(targetUserId)` need `canManageProfiles` (production previously demanded the owner for the avatar and any manager for documents). The unused `requireOwner` import came out of `clinic.functions.ts`.
- Demo gaps closed: `setCommissionRate` now authorizes (`team.commission`); `deleteMyDocument` deletes only the caller's own row, as production does.

### p3-06-verify-commit

| Check | Result |
| ----- | ------ |
| `check:policy` | ok — 170 handlers |
| `check:validators` | only the two pre-existing `saveAppointment` problems |
| Unit | `permissions`, `access-catalogue` pass; `policy-scope` has its one pre-existing failure (`inviteStaffMember` is `manager` in the pulled code, the test expects `owner`) — not touched |
| tsc | 116 = baseline |
| Lint | `access-control-settings.tsx` 130 → 100 (new block Prettier-clean; 30 inherited findings cleared by the re-indent), all other touched files delta 0, `staff-access.ts` 0 |
| Grid | owner sees both rows with dashes for Receptionist and Practitioner |
