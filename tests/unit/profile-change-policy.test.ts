import { describe, expect, it } from "vitest";
import {
  profileChangeApproverIds,
  profileChangeAttentionItems,
  profileChangeShowsReviewer,
} from "@/lib/profile-change-policy";
import { canApproveStaffRequests } from "@/lib/staff-access";

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

describe("profileChangeAttentionItems", () => {
  const pending = {
    id: "req-1",
    user_id: "prac-1",
    full_name: "Dr Nadia Rahman",
    job_title: "Senior Aesthetic Practitioner",
    note: "Promoted to senior in July.",
    requires_owner: false,
    status: "pending",
    inbox_cleared_at: null,
  };

  it("lists pending staff requests for the owner and hides the viewer's own", () => {
    const items = profileChangeAttentionItems(
      [pending, { ...pending, id: "req-2", user_id: "owner-1", full_name: "Dr Amara Osei" }],
      { userId: "owner-1", isOwner: true },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("staff_request");
    expect(items[0]?.title).toBe("Dr Nadia Rahman — profile change");
    expect(items[0]?.subtitle).toBe("Promoted to senior in July. · Profile change");
    expect(items[0]?.href).toBe("/team#profile-change-requests");
  });

  it("hides owner-only requests from a manager", () => {
    expect(
      profileChangeAttentionItems([{ ...pending, requires_owner: true }], {
        userId: "manager-1",
        isOwner: false,
      }),
    ).toEqual([]);
  });

  it("Requests to approve: owner always, manager only once granted Approve staff requests", () => {
    expect(canApproveStaffRequests({ isOwner: true, roles: ["owner"] })).toBe(true);
    expect(canApproveStaffRequests({ isAdmin: true, roles: [] })).toBe(true);
    expect(canApproveStaffRequests({ roles: ["manager"], permissions: [] })).toBe(false);
    expect(
      canApproveStaffRequests({ roles: ["manager"], permissions: ["team.approve_changes"] }),
    ).toBe(true);
    expect(
      canApproveStaffRequests({ roles: ["practitioner"], permissions: ["team.approve_changes"] }),
    ).toBe(false);
  });
});
