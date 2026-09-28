/** How a staff member’s own profile fields are saved or sent for approval. */

export const WORKING_ARRANGEMENTS = [
  "Full time",
  "Part time",
  "Self-employed",
  "Contractor",
  "Bank / locum",
] as const;

export type WorkingArrangement = (typeof WORKING_ARRANGEMENTS)[number];

type RoleRow = { user_id: string; role: string };

/** Clinic owner (or software admin) applies identity changes themselves. */
export function canSelfApplyIdentityChanges(identity: {
  isOwner?: boolean;
  isAdmin?: boolean;
}) {
  return Boolean(identity.isOwner || identity.isAdmin);
}

/**
 * A manager who is not the clinic owner must ask the owner to change
 * their own name, job title, registration, work email or working arrangement.
 */
export function profileChangeRequiresOwner(identity: {
  isOwner?: boolean;
  isAdmin?: boolean;
  roles?: string[];
}) {
  if (canSelfApplyIdentityChanges(identity)) return false;
  return Boolean(identity.roles?.includes("manager"));
}

/** True when someone holds the manager role and is not also the owner. */
export function clinicHasSeparateManager(roles: RoleRow[]) {
  const owners = new Set(roles.filter((r) => r.role === "owner").map((r) => r.user_id));
  return roles.some((r) => r.role === "manager" && !owners.has(r.user_id));
}

const APPROVE_PROFILE_CHANGES = "team.approve_changes";

/**
 * Who should be pinged about a profile change request.
 * Owners (and software admins) always receive it. Everyone else only does
 * when the owner has granted Approve profile change requests.
 */
export function profileChangeApproverIds(input: {
  requesterId: string;
  requiresOwner: boolean;
  roleRows: RoleRow[];
  profiles?: { id: string; clinic_role_id?: string | null }[];
  roleGrants: { role: string; permission: string; enabled: boolean }[];
  namedGrants?: { clinic_role_id: string; permission: string; enabled: boolean }[];
}): string[] {
  const ids = new Set<string>();
  for (const row of input.roleRows) {
    if (row.role === "owner" || row.role === "admin") ids.add(row.user_id);
  }
  if (!input.requiresOwner) {
    const grantedRoles = new Set(
      input.roleGrants
        .filter((grant) => grant.permission === APPROVE_PROFILE_CHANGES && grant.enabled)
        .map((grant) => grant.role),
    );
    for (const row of input.roleRows) {
      if (grantedRoles.has(row.role)) ids.add(row.user_id);
    }
    const grantedPacks = new Set(
      (input.namedGrants ?? [])
        .filter((grant) => grant.permission === APPROVE_PROFILE_CHANGES && grant.enabled)
        .map((grant) => grant.clinic_role_id),
    );
    for (const profile of input.profiles ?? []) {
      if (profile.clinic_role_id && grantedPacks.has(profile.clinic_role_id)) ids.add(profile.id);
    }
  }
  ids.delete(input.requesterId);
  return [...ids];
}

/** Name the reviewer when owner and a granted manager can both act on this request. */
export function profileChangeShowsReviewer(input: Parameters<typeof profileChangeApproverIds>[0]) {
  return profileChangeApproverIds(input).length > 1;
}

/** Owner, software admin, or the manager role — the people who review staff profile updates. */
export function canSeeProfileChangeAttention(identity: {
  isOwner?: boolean;
  isAdmin?: boolean;
  roles?: string[];
}) {
  return Boolean(identity.isOwner || identity.isAdmin || identity.roles?.includes("manager"));
}

type ProfileChangeRequestRow = {
  id: string;
  user_id: string;
  full_name?: string | null;
  job_title?: string | null;
  registration_body?: string | null;
  registration_number?: string | null;
  registration_expiry?: string | null;
  work_email?: string | null;
  working_arrangement?: string | null;
  note?: string | null;
  requires_owner?: boolean | null;
  status?: string | null;
  inbox_cleared_at?: string | null;
};

export function profileChangeRequestSummary(row: ProfileChangeRequestRow) {
  const note = row.note?.trim();
  if (note) return note;
  const bits = [
    row.job_title ? "job title" : null,
    row.registration_body || row.registration_number || row.registration_expiry
      ? "registration"
      : null,
    row.work_email ? "work email" : null,
    row.working_arrangement ? "working arrangement" : null,
  ].filter(Boolean);
  return bits.join(", ") || "Profile update";
}

/** Pending requests the viewer can act on, for Attention needed → This week. */
export function profileChangeAttentionItems(
  requests: ProfileChangeRequestRow[],
  viewer: { userId: string; isOwner?: boolean; isAdmin?: boolean },
) {
  return requests
    .filter((row) => {
      if (row.status && row.status !== "pending") return false;
      if (row.inbox_cleared_at) return false;
      if (row.user_id === viewer.userId) return false;
      if (row.requires_owner && !viewer.isOwner && !viewer.isAdmin) return false;
      return true;
    })
    .map((row) => ({
      id: `profile-change-${row.id}`,
      kind: "profile_change",
      urgency: "this_week" as const,
      title: `${(row.full_name ?? "").trim() || "Team member"} — profile change`,
      subtitle: profileChangeRequestSummary(row),
      href: "/team#profile-change-requests",
    }));
}
