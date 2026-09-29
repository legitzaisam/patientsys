import { describe, expect, it } from "vitest";
import { firstName, nameParts, shortName, staffLane } from "@/lib/staff-lane";
import { questionPreview, triageMessage } from "@/lib/tasks/urgent-triage";
import { laneFor } from "@/lib/practitioner-colours";

describe("staff-lane", () => {
  it("drops the title, shortens the surname, keeps the sidebar's lane", () => {
    expect(nameParts("Dr Nadia Rahman")).toEqual(["Nadia", "Rahman"]);
    expect(shortName("Dr Nadia Rahman")).toBe("Nadia R.");
    expect(shortName("Maya Chen")).toBe("Maya C.");
    expect(shortName("Prof. Amara Osei")).toBe("Amara O.");
    expect(shortName("Sofia")).toBe("Sofia");
    expect(shortName(null)).toBe("");
    expect(firstName("Dr Tom Whitfield")).toBe("Tom");
    const lane = staffLane("10000000-0000-4000-8000-000000000002", "Dr Nadia Rahman");
    expect(lane.tone).toBe(laneFor("10000000-0000-4000-8000-000000000002"));
    expect(lane.initials).toBe("DN");
    expect(lane.short).toBe("Nadia R.");
    expect(staffLane(null, "").initials).toBe("?");
  });
});

describe("urgent-triage", () => {
  it("flags symptoms and worries, lets thanks through", () => {
    expect(triageMessage("Is redness on day 3 normal?")).toEqual({
      urgent: true,
      reason: "symptom",
    });
    expect(triageMessage("I have some swelling on the left side")).toMatchObject({
      urgent: true,
      reason: "symptom",
    });
    expect(triageMessage("Should I be worried about a small lump?")).toMatchObject({
      urgent: true,
    });
    expect(triageMessage("OK to go to the gym the day after?")).toEqual({
      urgent: true,
      reason: "worry",
    });
    expect(triageMessage("Can I fly two days after treatment?")).toMatchObject({ urgent: true });
    expect(triageMessage("Thanks so much, see you next week!")).toEqual({
      urgent: false,
      reason: null,
    });
    expect(triageMessage("How much is the top-up if I book this month?")).toEqual({
      urgent: false,
      reason: null,
    });
    expect(triageMessage("")).toEqual({ urgent: false, reason: null });
  });
  it("previews the first question", () => {
    expect(questionPreview("Hi! Is redness on day 3 normal? It started yesterday.")).toBe(
      "Is redness on day 3 normal?",
    );
    expect(questionPreview("A".repeat(80))).toHaveLength(60);
    expect(questionPreview("A".repeat(80)).endsWith("…")).toBe(true);
  });
});
