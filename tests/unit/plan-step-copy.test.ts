import { describe, expect, it } from "vitest";
import { skinPlanDueForAttention } from "@/components/patients/plan-step-copy";

describe("skinPlanDueForAttention", () => {
  const today = "2026-09-28";

  it("keeps overdue and due-within-14-days steps", () => {
    expect(skinPlanDueForAttention("2026-09-20", today)).toBe(true);
    expect(skinPlanDueForAttention("2026-09-28", today)).toBe(true);
    expect(skinPlanDueForAttention("2026-10-12", today)).toBe(true);
  });

  it("drops undated steps and those due after 14 days", () => {
    expect(skinPlanDueForAttention(null, today)).toBe(false);
    expect(skinPlanDueForAttention("2026-10-13", today)).toBe(false);
  });
});
