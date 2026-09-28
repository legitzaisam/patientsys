import { describe, expect, it } from "vitest";
import {
  clockOptions,
  dateToDayKey,
  dayKeyToDate,
  formatDayInput,
  normaliseClock,
  parseDayInput,
} from "@/lib/field-parse";

describe("normaliseClock", () => {
  it("reads the forgiving forms into HH:MM", () => {
    expect(normaliseClock("9")).toBe("09:00");
    expect(normaliseClock("9:5")).toBe("09:05");
    expect(normaliseClock("0930")).toBe("09:30");
    expect(normaliseClock("930")).toBe("09:30");
    expect(normaliseClock("9.30")).toBe("09:30");
    expect(normaliseClock("17:30")).toBe("17:30");
    expect(normaliseClock("5pm")).toBe("17:00");
    expect(normaliseClock("5:30 pm")).toBe("17:30");
    expect(normaliseClock("12am")).toBe("00:00");
    expect(normaliseClock("12pm")).toBe("12:00");
  });
  it("rejects what is not a clock time", () => {
    expect(normaliseClock("")).toBeNull();
    expect(normaliseClock("25:00")).toBeNull();
    expect(normaliseClock("9:75")).toBeNull();
    expect(normaliseClock("noon")).toBeNull();
  });
});

describe("clockOptions", () => {
  it("steps through the day inclusively", () => {
    const opts = clockOptions(30, "08:00", "10:00");
    expect(opts).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
    expect(clockOptions()).toHaveLength(65);
  });
});

describe("parseDayInput / formatDayInput", () => {
  it("reads UK, ISO and long forms", () => {
    expect(parseDayInput("13/11/2027")).toBe("2027-11-13");
    expect(parseDayInput("13-11-2027")).toBe("2027-11-13");
    expect(parseDayInput("13.11.27")).toBe("2027-11-13");
    expect(parseDayInput("2027-11-13")).toBe("2027-11-13");
    expect(parseDayInput("13 Nov 2027")).toBe("2027-11-13");
    expect(parseDayInput("13 November 2027")).toBe("2027-11-13");
    expect(parseDayInput("1/2/2027")).toBe("2027-02-01");
  });
  it("rejects impossible dates", () => {
    expect(parseDayInput("31/02/2027")).toBeNull();
    expect(parseDayInput("13/13/2027")).toBeNull();
    expect(parseDayInput("13 Foo 2027")).toBeNull();
    expect(parseDayInput("")).toBeNull();
  });
  it("formats a key as DD/MM/YYYY and round-trips", () => {
    expect(formatDayInput("2027-11-13")).toBe("13/11/2027");
    expect(formatDayInput(null)).toBe("");
    expect(parseDayInput(formatDayInput("2026-02-28"))).toBe("2026-02-28");
  });
  it("converts to and from a local Date at noon", () => {
    const d = dayKeyToDate("2027-11-13")!;
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(12);
    expect(dateToDayKey(d)).toBe("2027-11-13");
    expect(dayKeyToDate("nonsense")).toBeUndefined();
  });
});
