import { can } from "@/lib/permissions";

/**
 * Who may open a colleague's full profile. The clinic owner and the software
 * admin always can; a manager can while the owner has granted
 * `team.manage_profiles` under Staff access; nobody else, whatever they hold.
 */
type IdentityLike =
  | {
      isOwner?: boolean;
      isAdmin?: boolean;
      roles?: string[];
      permissions?: string[];
    }
  | null
  | undefined;

function isManagerRole(identity: IdentityLike) {
  return Boolean(identity?.roles?.includes("manager"));
}

/** Edit a colleague's details, working pattern and bookable treatments; approve their time off. */
export function canManageProfiles(identity: IdentityLike): boolean {
  if (!identity) return false;
  if (identity.isOwner || identity.isAdmin) return true;
  return isManagerRole(identity) && can(identity, "team.manage_profiles");
}

/** See and set a colleague's commission rate and open their Performance & earnings. */
export function canSetCommission(identity: IdentityLike): boolean {
  if (!identity) return false;
  if (identity.isOwner || identity.isAdmin) return true;
  return (
    isManagerRole(identity) &&
    can(identity, "team.manage_profiles") &&
    can(identity, "team.commission")
  );
}

/** The layout a viewer gets on a colleague's page. */
export function colleagueView(identity: IdentityLike): "manage" | "frontdesk" {
  return canManageProfiles(identity) ? "manage" : "frontdesk";
}
