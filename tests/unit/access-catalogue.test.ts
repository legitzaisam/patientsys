import { describe, expect, it } from "vitest";
import {
  ACCESS_CATALOGUE,
  catalogueGrantRows,
  canSee,
  pageNodeForPath,
} from "@/lib/access-catalogue";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { rolePermissions } from "@/lib/demo/data";

describe("access catalogue", () => {
  it("uses unique ids and real permission keys", () => {
    const ids = ACCESS_CATALOGUE.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("access");
    for (const node of ACCESS_CATALOGUE) {
      expect(PERMISSION_KEYS).toContain(node.permission);
      if (node.parentId) expect(ids).toContain(node.parentId);
    }
  });

  it("keeps one default when two surfaces share a permission", () => {
    const byPermission = new Map<string, string>();
    for (const node of ACCESS_CATALOGUE) {
      const stamp = JSON.stringify(node.defaults);
      const previous = byPermission.get(node.permission);
      if (previous) expect(previous).toBe(stamp);
      else byPermission.set(node.permission, stamp);
    }
  });

  it("matches the demo grant rows", () => {
    for (const row of catalogueGrantRows()) {
      if (!row.permission.startsWith("view.") && row.role === "patient") continue;
      const found = rolePermissions.find(
        (entry) => entry.role === row.role && entry.permission === row.permission,
      );
      expect(found?.enabled ?? false).toBe(row.enabled);
    }
  });

  it("hides a child when its page is off", () => {
    const identity = { permissions: ["view.dashboard.diary"] };
    expect(canSee(identity, "dashboard-diary")).toBe(false);
    expect(canSee({ isOwner: true, permissions: [] }, "schedule")).toBe(true);
    expect(canSee({ permissions: [] }, "access")).toBe(false);
  });

  it("matches patient records and portal pages by path", () => {
    expect(pageNodeForPath("/patients")?.id).toBe("patients");
    expect(pageNodeForPath("/patients/abc")?.id).toBe("patient-record");
    expect(pageNodeForPath("/my-record/plan/journal")?.id).toBe("portal-plan-journal");
    expect(pageNodeForPath("/access")).toBeUndefined();
  });
});
