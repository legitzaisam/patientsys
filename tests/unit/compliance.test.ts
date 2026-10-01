import { describe, expect, it } from "vitest";
import { complianceReminders } from "@/lib/metrics/compliance";

const today = "2026-10-01";

function staff(over: { id: string; expiry: string; name?: string }) {
  return {
    id: over.id,
    full_name: over.name ?? "Nadia Rahman",
    registration_body: "NMC",
    registration_expiry: over.expiry,
  };
}

describe("complianceReminders", () => {
  it("keeps Attention needed for renewals under 30 days, including lapsed", () => {
    const items = complianceReminders(
      [
        staff({ id: "n45", expiry: "2026-11-15" }), // 45 days
        staff({ id: "n30", expiry: "2026-10-31" }), // 30 days
        staff({ id: "n29", expiry: "2026-10-30" }), // 29 days
        staff({ id: "t28", expiry: "2026-10-29", name: "Tom Whitfield" }),
        staff({ id: "lapsed", expiry: "2026-09-20" }),
      ],
      today,
    );
    expect(items.map((i) => i.id)).toEqual([
      "compliance-registration-n29",
      "compliance-registration-t28",
      "compliance-registration-lapsed",
    ]);
    expect(items.find((i) => i.id.endsWith("t28"))?.subtitle).toMatch(/In 28 days/);
  });
});
