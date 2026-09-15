import { describe, expect, it } from "vitest";
import { can, PERMISSION_GROUPS, PERMISSION_KEYS, PERMISSION_META } from "@/lib/permissions";

describe("can", () => {
  it("refuses a missing identity", () => {
    expect(can(null, "patients.edit")).toBe(false);
    expect(can(undefined, "comms.send")).toBe(false);
  });

  it("grants owners every capability without explicit rows", () => {
    for (const key of PERMISSION_KEYS) {
      expect(can({ isOwner: true, permissions: [] }, key)).toBe(true);
    }
  });

  it("does not treat manager as a blanket grant", () => {
    for (const key of PERMISSION_KEYS) {
      expect(can({ isManager: true, permissions: [] }, key)).toBe(false);
    }
  });

  it("grants non-owners exactly the keys they hold", () => {
    const identity = { permissions: ["comms.send", "appointments.edit"] };
    expect(can(identity, "comms.send")).toBe(true);
    expect(can(identity, "appointments.edit")).toBe(true);
    expect(can(identity, "patients.edit")).toBe(false);
    expect(can(identity, "team.view")).toBe(false);
  });
});

describe("permission key registry", () => {
  it("gives every key a label, a description and a display group", () => {
    const grouped = new Set(PERMISSION_GROUPS.flatMap((group) => group.keys));
    for (const key of PERMISSION_KEYS) {
      expect(PERMISSION_META[key]?.label).toBeTruthy();
      expect(PERMISSION_META[key]?.description).toBeTruthy();
      expect(grouped.has(key)).toBe(true);
    }
  });
});
