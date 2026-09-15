import { describe, expect, it } from "vitest";
import {
  appointmentReminderMessage,
  bookingUpdatedMessage,
  channelsFor,
  reminderTimes,
  renderTemplate,
} from "@/lib/comms/templates";

describe("renderTemplate", () => {
  const vars = { first_name: "Olivia", treatment: "Lip filler", clinic: "Aetheria" };

  it("fills known variables, with or without inner spaces", () => {
    expect(renderTemplate("Hi {{first_name}}, your {{ treatment }} at {{clinic}}.", vars)).toBe(
      "Hi Olivia, your Lip filler at Aetheria.",
    );
  });

  it("leaves unknown variables visible instead of blanking them", () => {
    expect(renderTemplate("Hi {{first_name}}, see you on {{due_date}}.", vars)).toBe(
      "Hi Olivia, see you on {{due_date}}.",
    );
  });

  it("ignores unclosed braces rather than corrupting the text", () => {
    expect(renderTemplate("Hi {{first_name, welcome", vars)).toBe("Hi {{first_name, welcome");
  });
});

describe("channelsFor", () => {
  const both = { email: "x@y.z", phone: "07700900000" };

  it("prefers email for transactional and marketing sends", () => {
    expect(channelsFor(both, "transactional")).toEqual(["email"]);
    expect(channelsFor(both, "marketing")).toEqual(["email"]);
  });

  it("adds SMS for reminders when a phone exists", () => {
    expect(channelsFor(both, "reminder")).toEqual(["email", "sms"]);
  });

  it("falls back to SMS when there is no email", () => {
    expect(channelsFor({ phone: "07700900000" }, "transactional")).toEqual(["sms"]);
  });

  it("returns nothing when the patient has no contact details", () => {
    expect(channelsFor({ email: " ", phone: null }, "reminder")).toEqual([]);
  });
});

describe("reminderTimes", () => {
  const NOW = new Date("2026-06-01T09:00:00.000Z");
  const START = "2026-06-10T14:00:00.000Z";

  it("computes one send per offset, earliest first", () => {
    expect(reminderTimes(START, [24, 168], NOW)).toEqual([
      "2026-06-03T14:00:00.000Z", // 168h before
      "2026-06-09T14:00:00.000Z", // 24h before
    ]);
  });

  it("skips offsets already in the past for late bookings", () => {
    const soon = "2026-06-01T15:00:00.000Z"; // in six hours
    expect(reminderTimes(soon, [168, 24], NOW)).toEqual([]);
    expect(reminderTimes(soon, [168, 24, 2], NOW)).toEqual(["2026-06-01T13:00:00.000Z"]);
  });

  it("drops junk offsets and de-duplicates", () => {
    expect(reminderTimes(START, [24, 24, 0, -5, Number.NaN], NOW)).toEqual([
      "2026-06-09T14:00:00.000Z",
    ]);
  });

  it("returns nothing for an unparseable start", () => {
    expect(reminderTimes("not-a-date", [24], NOW)).toEqual([]);
  });
});

describe("message builders", () => {
  it("reminder mentions the treatment, time and practitioner", () => {
    const body = appointmentReminderMessage({
      name: "Olivia",
      treatment: "Lip filler",
      when: "Wednesday 10 June, 14:00",
      practitioner: "Nadia Rahman",
    });
    expect(body).toContain("a reminder of your Lip filler appointment");
    expect(body).toContain("Wednesday 10 June, 14:00 with Nadia Rahman");
  });

  it("reschedule notice names the new time", () => {
    const body = bookingUpdatedMessage({
      name: "Olivia",
      treatment: "Lip filler",
      treatmentNumber: 2,
      when: "Friday 12 June, 10:00",
    });
    expect(body).toContain("has been rescheduled to Friday 12 June, 10:00");
    expect(body).toContain("(treatment #2)");
  });
});
