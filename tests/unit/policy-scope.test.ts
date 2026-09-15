import { describe, expect, it } from "vitest";
import { POLICY, resolveScope } from "@/lib/auth/policy";

const practitioner = { userId: "u-prac", isManager: false, roles: ["practitioner"] };
const managerPractitioner = {
  userId: "u-mgr-prac",
  isManager: true,
  roles: ["practitioner", "manager"],
};
const frontDesk = { userId: "u-desk", isManager: false, roles: ["front_desk"] };
const owner = { userId: "u-owner", isManager: true, roles: ["owner"] };

describe("resolveScope", () => {
  it("narrows a practitioner to their own book on the dashboard and retention", () => {
    expect(resolveScope(practitioner, "getDashboard")).toBe("u-prac");
    expect(resolveScope(practitioner, "getRetention")).toBe("u-prac");
  });

  it("keeps managers and non-practitioners clinic-wide on practitionerOwnBook handlers", () => {
    expect(resolveScope(managerPractitioner, "getDashboard")).toBeNull();
    expect(resolveScope(frontDesk, "getDashboard")).toBeNull();
    expect(resolveScope(owner, "getRetention")).toBeNull();
  });

  it("narrows everyone below manager on nonManagerOwnAssignments handlers", () => {
    expect(resolveScope(practitioner, "listOpenRecallTasks")).toBe("u-prac");
    expect(resolveScope(frontDesk, "listOpenRecallTasks")).toBe("u-desk");
    expect(resolveScope(owner, "listOpenRecallTasks")).toBeNull();
    expect(resolveScope(managerPractitioner, "listOpenRecallTasks")).toBeNull();
  });

  it("leaves handlers without a scope rule clinic-wide for every role", () => {
    for (const identity of [practitioner, managerPractitioner, frontDesk, owner]) {
      expect(resolveScope(identity, "listPatients")).toBeNull();
      expect(resolveScope(identity, "listAppointments")).toBeNull();
    }
  });
});

describe("POLICY invariants", () => {
  it("keeps destructive team administration on the owner", () => {
    expect(POLICY.createStaffAccount).toEqual({ kind: "owner" });
    expect(POLICY.inviteStaffMember).toEqual({ kind: "owner" });
    expect(POLICY.revokeStaffAccess).toEqual({ kind: "owner" });
    expect(POLICY.setRolePermission).toEqual({ kind: "owner" });
    expect(POLICY.archivePatient).toEqual({ kind: "owner" });
  });

  it("keeps patient-owned actions off the capability system", () => {
    expect(POLICY.signDocument).toEqual({ kind: "patientSelf" });
    expect(POLICY.getMyRecord).toEqual({ kind: "self" });
  });

  it("gates every comms writer on comms.send", () => {
    expect(POLICY.enqueueCommunication).toEqual({ kind: "capability", key: "comms.send" });
    expect(POLICY.drainCommunications).toEqual({ kind: "capability", key: "comms.send" });
    expect(POLICY.sendMessage).toEqual({ kind: "staffOrOwnPatient", staffKey: "comms.send" });
  });
});
