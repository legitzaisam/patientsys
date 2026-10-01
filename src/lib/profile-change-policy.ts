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
 * when the owner has granted Approve staff requests.
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

/**
 * Pending profile changes the viewer can act on, for Attention needed → This
 * week → Requests to approve, beside the time-off and working-pattern requests.
 */
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
      kind: "staff_request",
      urgency: "this_week" as const,
      title: `${(row.full_name ?? "").trim() || "Team member"} — profile change`,
      // The list shows the last segment first: "Profile change · job title, registration".
      subtitle: `${profileChangeRequestSummary(row)} · Profile change`,
      href: "/team#profile-change-requests",
    }));
}

/* ---------------------------------------------------------------- staff requests to approve */

type StaffRequestPatternRow = {
  id: string;
  user_id: string;
  status?: string | null;
  requires_owner?: boolean | null;
  /** Ready-made "Wed 10:00–18:00 (was Off)" line, built by the caller from the two patterns. */
  summary: string;
};

type StaffRequestTimeOffRow = {
  id: string;
  user_id: string;
  status?: string | null;
  /** "Holiday · 4 working days" */
  what: string;
  /** "Mon 19 – Fri 23 Oct" */
  when: string;
};

/**
 * One Attention row per pending working-pattern or time-off request, for the
 * people who can approve it. The viewer's own requests are left out, and a
 * request a non-owner manager raised about themselves (requires_owner) is
 * shown to the owner and admin only. Every row opens the colleague's
 * Schedule tab, where Approve / Decline live.
 */
export function staffRequestAttentionItems(
  input: {
    patternRequests: StaffRequestPatternRow[];
    timeOff: StaffRequestTimeOffRow[];
    nameOf: (userId: string) => string;
  },
  viewer: { userId: string; isOwner?: boolean; isAdmin?: boolean },
) {
  const visible = (row: {
    user_id: string;
    status?: string | null;
    requires_owner?: boolean | null;
  }) => {
    if (row.status && row.status !== "pending") return false;
    if (row.user_id === viewer.userId) return false;
    if (row.requires_owner && !viewer.isOwner && !viewer.isAdmin) return false;
    return true;
  };
  const name = (userId: string) => input.nameOf(userId).trim() || "Team member";
  return [
    ...input.patternRequests.filter(visible).map((row) => ({
      id: `pattern-request-${row.id}`,
      kind: "staff_request",
      urgency: "this_week" as const,
      title: `${name(row.user_id)} — working pattern`,
      subtitle: row.summary,
      href: `/team/${row.user_id}?tab=schedule`,
    })),
    ...input.timeOff.filter(visible).map((row) => ({
      id: `time-off-request-${row.id}`,
      kind: "staff_request",
      urgency: "this_week" as const,
      title: `${name(row.user_id)} — time off`,
      subtitle: `${row.what} · ${row.when}`,
      href: `/team/${row.user_id}?tab=schedule`,
    })),
  ];
}
