import { describe, expect, it } from "vitest";
import {
  boardRisk,
  dueBucketKey,
  hitTile,
  isTileKey,
  riskUrgency,
  tileMatches,
} from "@/lib/patients/board-risk";

const today = "2026-09-29";
const step = (dueDate: string) => ({ dueDate });

describe("boardRisk", () => {
  it("no-show, then booked-for-step, then wrong booking, then overdue, then no booking", () => {
    expect(
      boardRisk({
        nextMilestone: step("2026-09-20"),
        overdue: true,
        noShowAt: "2026-09-24T10:00:00Z",
      }),
    ).toBe("noshow");
    expect(
      boardRisk({
        nextMilestone: step("2026-09-20"),
        overdue: false,
        stepBookedAt: "2026-10-01T10:00:00Z",
      }),
    ).toBe("ontrack");
    expect(
      boardRisk({
        nextMilestone: step("2026-10-05"),
        overdue: false,
        otherBookingTreatment: "Profhilo",
      }),
    ).toBe("mismatch");
    expect(boardRisk({ nextMilestone: step("2026-09-20"), overdue: true })).toBe("overdue");
    expect(boardRisk({ nextMilestone: step("2026-10-05"), overdue: false })).toBe("nobook");
    // A wrong booking on an overdue step still reads as the wrong booking.
    expect(
      boardRisk({
        nextMilestone: step("2026-09-20"),
        overdue: true,
        otherBookingTreatment: "Profhilo",
      }),
    ).toBe("mismatch");
  });
});

describe("dueBucketKey", () => {
  it("overdue / week / fortnight / later", () => {
    expect(dueBucketKey({ nextMilestone: step("2026-09-20"), overdue: true }, today)).toBe(
      "overdue",
    );
    expect(dueBucketKey({ nextMilestone: step("2026-10-02"), overdue: false }, today)).toBe("week");
    expect(dueBucketKey({ nextMilestone: step("2026-10-06"), overdue: false }, today)).toBe("week");
    expect(dueBucketKey({ nextMilestone: step("2026-10-07"), overdue: false }, today)).toBe(
      "fortnight",
    );
    expect(dueBucketKey({ nextMilestone: step("2026-10-20"), overdue: false }, today)).toBe(
      "later",
    );
    expect(dueBucketKey({ nextMilestone: null, overdue: false }, today)).toBe("later");
    // A booked step whose date has passed is not "overdue" in the bucket either.
    expect(
      dueBucketKey(
        { nextMilestone: step("2026-09-20"), overdue: false, stepBookedAt: "2026-10-01T10:00:00Z" },
        today,
      ),
    ).toBe("week");
  });
});

describe("tiles", () => {
  it("due this week is the unbooked steps inside 7 days; OR across selected tiles", () => {
    const soon = { risk: "nobook" as const, dueBucket: "week" as const };
    const later = { risk: "nobook" as const, dueBucket: "later" as const };
    const late = { risk: "overdue" as const, dueBucket: "overdue" as const };
    expect(tileMatches("due_this_week", soon)).toBe(true);
    expect(tileMatches("due_this_week", later)).toBe(false);
    expect(tileMatches("nobook", later)).toBe(true);
    expect(hitTile(["overdue", "noshow"], late)).toBe("overdue");
    expect(hitTile(["overdue", "noshow"], soon)).toBeNull();
    expect(hitTile(["due_this_week", "nobook"], soon)).toBe("due_this_week");
    expect(isTileKey("due_this_week")).toBe(true);
    expect(isTileKey("week")).toBe(false);
  });
  it("urgency sorts riskier then sooner", () => {
    const a = riskUrgency({ risk: "overdue", nextMilestone: step("2026-09-20") }, today);
    const b = riskUrgency({ risk: "nobook", nextMilestone: step("2026-10-01") }, today);
    const c = riskUrgency({ risk: "nobook", nextMilestone: step("2026-10-10") }, today);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});
