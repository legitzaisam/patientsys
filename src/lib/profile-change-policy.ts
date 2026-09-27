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
