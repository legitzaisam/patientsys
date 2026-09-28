import { describe, expect, it } from "vitest";
import { staffRequestAttentionItems } from "@/lib/profile-change-policy";

const names: Record<string, string> = {
  tom: "Dr Tom Whitfield",
  maya: "Maya Chen",
  nadia: "Dr Nadia Rahman",
};
const input = {
  patternRequests: [
    {
      id: "p1",
      user_id: "tom",
      status: "pending",
      requires_owner: false,
      summary: "Sat Off (was 09:00–14:00)",
    },
    {
      id: "p2",
      user_id: "maya",
      status: "pending",
      requires_owner: true,
      summary: "Fri Off (was 09:00–17:30)",
    },
    {
      id: "p3",
      user_id: "tom",
      status: "approved",
      requires_owner: false,
      summary: "Mon 08:00–16:00 (was 10:00–19:00)",
    },
  ],
  timeOff: [
    {
      id: "t1",
      user_id: "nadia",
      status: "pending",
      what: "Holiday · 1 working day",
      when: "Fri 30 Oct",
    },
    {
      id: "t2",
      user_id: "nadia",
      status: "approved",
      what: "Holiday · 4 working days",
      when: "Mon 19 – Fri 23 Oct",
    },
  ],
  nameOf: (id: string) => names[id] ?? "",
};

describe("staffRequestAttentionItems", () => {
  it("gives the owner every pending request, linking to the Schedule tab", () => {
    const items = staffRequestAttentionItems(input, { userId: "owner", isOwner: true });
    expect(items.map((i) => i.id)).toEqual([
      "pattern-request-p1",
      "pattern-request-p2",
      "time-off-request-t1",
    ]);
    expect(items[0]).toMatchObject({
      kind: "staff_request",
      urgency: "this_week",
      title: "Dr Tom Whitfield — working pattern",
      subtitle: "Sat Off (was 09:00–14:00)",
      href: "/team/tom?tab=schedule",
    });
    expect(items[2]).toMatchObject({
      title: "Dr Nadia Rahman — time off",
      subtitle: "Holiday · 1 working day · Fri 30 Oct",
      href: "/team/nadia?tab=schedule",
    });
  });
  it("hides a manager's own request and the ones only the owner may decide", () => {
    const items = staffRequestAttentionItems(input, { userId: "maya", isOwner: false });
    expect(items.map((i) => i.id)).toEqual(["pattern-request-p1", "time-off-request-t1"]);
  });
  it("falls back to Team member when the name is unknown", () => {
    const items = staffRequestAttentionItems(
      { ...input, nameOf: () => "" },
      { userId: "owner", isOwner: true },
    );
    expect(items[0]!.title).toBe("Team member — working pattern");
  });
});
