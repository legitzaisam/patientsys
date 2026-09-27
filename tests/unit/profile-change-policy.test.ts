import { describe, expect, it } from "vitest";
import { profileChangeApproverIds, profileChangeShowsReviewer } from "@/lib/profile-change-policy";

const owner = { user_id: "owner-1", role: "owner" };
const manager = { user_id: "manager-1", role: "manager" };
const practitioner = { user_id: "prac-1", role: "practitioner" };

describe("profileChangeApproverIds", () => {
  it("always notifies the owner, never the person who submitted", () => {
    expect(
      profileChangeApproverIds({
        requesterId: "prac-1",
        requiresOwner: false,
        roleRows: [owner, manager, practitioner],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: false }],
      }),
    ).toEqual(["owner-1"]);
  });

  it("notifies a manager only when the owner has granted the capability", () => {
    expect(
      profileChangeApproverIds({
        requesterId: "prac-1",
        requiresOwner: false,
        roleRows: [owner, manager, practitioner],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: true }],
      }).sort(),
    ).toEqual(["manager-1", "owner-1"]);
  });

  it("keeps manager self-changes with the owner even if the manager can approve staff", () => {
    expect(
      profileChangeApproverIds({
        requesterId: "manager-1",
        requiresOwner: true,
        roleRows: [owner, manager],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: true }],
      }),
    ).toEqual(["owner-1"]);
  });
});

describe("profileChangeShowsReviewer", () => {
  it("is off when only the owner can approve", () => {
    expect(
      profileChangeShowsReviewer({
        requesterId: "prac-1",
        requiresOwner: false,
        roleRows: [owner, manager, practitioner],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: false }],
      }),
    ).toBe(false);
  });

  it("is on when a manager has been granted the capability", () => {
    expect(
      profileChangeShowsReviewer({
        requesterId: "prac-1",
        requiresOwner: false,
        roleRows: [owner, manager, practitioner],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: true }],
      }),
    ).toBe(true);
  });

  it("stays off for a manager's own request, which only the owner can approve", () => {
    expect(
      profileChangeShowsReviewer({
        requesterId: "manager-1",
        requiresOwner: true,
        roleRows: [owner, manager],
        roleGrants: [{ role: "manager", permission: "team.approve_changes", enabled: true }],
      }),
    ).toBe(false);
  });
});
