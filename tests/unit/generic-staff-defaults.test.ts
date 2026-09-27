import { describe, expect, it } from "vitest";
import { GENERIC_STAFF_DEFAULTS, loginRoleForClinicPack } from "@/lib/access-catalogue";

describe("generic staff defaults", () => {
  it("lets a forgotten invite work the floor without clinical or money rights", () => {
    expect(GENERIC_STAFF_DEFAULTS["view.schedule"]).toBe(true);
    expect(GENERIC_STAFF_DEFAULTS["appointments.edit"]).toBe(true);
    expect(GENERIC_STAFF_DEFAULTS["patients.edit"]).toBe(true);
    expect(GENERIC_STAFF_DEFAULTS["documents.send"]).toBe(true);
    expect(GENERIC_STAFF_DEFAULTS["view.patients.contact"]).toBe(true);

    expect(GENERIC_STAFF_DEFAULTS["view.patients.history"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["view.patients.treatments"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["treatments.record"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["photos.manage"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["reports.insights"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["reports.retention"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["view.earnings"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["offers.manage"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["settings.treatments"]).toBe(false);
    expect(GENERIC_STAFF_DEFAULTS["team.approve_changes"]).toBe(false);
  });

  it("keeps a named pack off the diary until treatments.record is granted", () => {
    expect(loginRoleForClinicPack(false)).toBe("front_desk");
    expect(loginRoleForClinicPack(true)).toBe("practitioner");
  });
});
