/** Rules for inviting onto built-in access levels and clinic-defined packs. */

export type InviteActor = {
  isOwner?: boolean;
  isManager?: boolean;
  roles?: string[];
};

export function canInviteStaff(identity: InviteActor | null | undefined) {
  return Boolean(identity?.isOwner || identity?.roles?.includes("manager"));
}

export function assertStaffInvite(args: {
  actor: InviteActor;
  role: "owner" | "manager" | "practitioner" | "front_desk";
  clinicRoleId?: string | null;
  hasSeparateManager: boolean;
}) {
  const invitingOwnerOrManager = args.role === "owner" || args.role === "manager";
  if (invitingOwnerOrManager && !args.actor.isOwner) {
    throw new Error("Only the clinic owner can invite that access level.");
  }
  if (args.role === "manager" && !args.hasSeparateManager) {
    throw new Error("This clinic does not have a separate manager role.");
  }
  if (args.clinicRoleId && invitingOwnerOrManager) {
    throw new Error("A named role cannot start as owner or manager access.");
  }
}

export function normalizeClinicRoleName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) throw new Error("Give the role a name.");
  if (trimmed.length > 80) throw new Error("Role name is too long.");
  const reserved = new Set(["owner", "clinic owner", "manager", "practitioner", "receptionist", "front desk", "admin"]);
  if (reserved.has(trimmed.toLowerCase())) {
    throw new Error("That name is already a built-in access level.");
  }
  return trimmed;
}
