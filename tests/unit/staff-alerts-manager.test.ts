import { describe, expect, it } from "vitest";
import { staffConversations, staffNotifications, USERS } from "@/lib/demo/data";

describe("demo manager inbox", () => {
  it("copies clinic-wide alerts to both the owner and the manager", () => {
    const titles = [
      "Urgent from Sofia Marchetti: Room 2 autoclave",
      "New booking",
      "Message from Dr Nadia Rahman: Stock",
      "No-show logged",
    ];
    for (const title of titles) {
      const recipients = staffNotifications
        .filter((n) => n.title === title)
        .map((n) => n.recipient_id)
        .sort();
      expect(recipients).toEqual([USERS.manager, USERS.owner].sort());
    }
  });

  it("keeps one-to-one messages on the person they were sent to", () => {
    const cover = staffNotifications.find((n) => n.title === "Message from Dr Amara Osei: Thursday cover");
    expect(cover?.recipient_id).toBe(USERS.practitioner2);
    expect(staffNotifications.some((n) => n.title === cover?.title && n.recipient_id === USERS.manager)).toBe(
      false,
    );

    const toMaya = staffNotifications.find((n) => n.title === "Message from Sofia Marchetti: Consent chase");
    expect(toMaya?.recipient_id).toBe(USERS.manager);
  });

  it("gives the manager their own staff chats", () => {
    const pair = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const keys = new Set(staffConversations.map((c) => pair(String(c.user_low), String(c.user_high))));
    expect(keys.has(pair(USERS.manager, USERS.frontDesk))).toBe(true);
    expect(keys.has(pair(USERS.manager, USERS.practitioner))).toBe(true);
    expect(keys.has(pair(USERS.manager, USERS.owner))).toBe(true);
  });
});
