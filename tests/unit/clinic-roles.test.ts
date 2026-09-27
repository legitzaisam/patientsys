import { describe, expect, it } from "vitest";
import { assertStaffInvite, canInviteStaff, normalizeClinicRoleName } from "@/lib/clinic-roles";

describe("clinic role invites", () => {
  it("lets the owner and a manager invite, but not reception", () => {
    expect(canInviteStaff({ isOwner: true, roles: ["owner"] })).toBe(true);
    expect(canInviteStaff({ isOwner: false, roles: ["manager"] })).toBe(true);
    expect(canInviteStaff({ isOwner: false, roles: ["front_desk"] })).toBe(false);
  });

  it("stops a manager inviting owner or manager access", () => {
    const manager = { isOwner: false, isManager: true, roles: ["manager"] };
    expect(() =>
      assertStaffInvite({
        actor: manager,
        role: "manager",
        hasSeparateManager: true,
      }),
    ).toThrow(/clinic owner/);
    expect(() =>
      assertStaffInvite({
        actor: manager,
        role: "front_desk",
        clinicRoleId: "role-1",
        hasSeparateManager: true,
      }),
    ).not.toThrow();
  });

  it("rejects a reserved or empty named role", () => {
    expect(() => normalizeClinicRoleName("Manager")).toThrow(/built-in/);
    expect(() => normalizeClinicRoleName("  ")).toThrow(/name/);
    expect(normalizeClinicRoleName("  Plastic  surgeon ")).toBe("Plastic surgeon");
  });
});
