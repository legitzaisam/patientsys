import { describe, expect, it } from "vitest";
import { periodRange, previousPeriodRange, periodWindowLabel, periodHeading } from "@/components/period-picker";

const NOW = new Date(2026, 8, 20, 15, 30, 0); // Sunday 20 Sep 2026

describe("periodRange", () => {
  it("resolves today, this week, this month and this year", () => {
    const day = periodRange({ key: "day", offset: 0 }, NOW);
    expect(new Date(day.from).getDate()).toBe(20);
    expect(new Date(day.to).getDate()).toBe(20);

    const week = periodRange({ key: "week", offset: 0 }, NOW);
    expect(new Date(week.from).getDate()).toBe(14);
    expect(new Date(week.to).getDate()).toBe(20);

    const month = periodRange({ key: "month", offset: 0 }, NOW);
    expect(new Date(month.from)).toEqual(new Date(2026, 8, 1));
    expect(new Date(month.to).getMonth()).toBe(8);

    const year = periodRange({ key: "year", offset: 0 }, NOW);
    expect(new Date(year.from)).toEqual(new Date(2026, 0, 1));
    expect(new Date(year.to).getFullYear()).toBe(2026);
  });

  it("steps back a day, week, month and year", () => {
    const yesterday = periodRange({ key: "day", offset: 1 }, NOW);
    expect(new Date(yesterday.from).getDate()).toBe(19);

    const lastWeek = periodRange({ key: "week", offset: 1 }, NOW);
    expect(new Date(lastWeek.from).getDate()).toBe(7);
    expect(new Date(lastWeek.to).getDate()).toBe(13);

    const lastMonth = periodRange({ key: "month", offset: 1 }, NOW);
    expect(new Date(lastMonth.from)).toEqual(new Date(2026, 7, 1));
    expect(new Date(lastMonth.to).getMonth()).toBe(7);

    const lastYear = periodRange({ key: "year", offset: 1 }, NOW);
    expect(new Date(lastYear.from).getFullYear()).toBe(2025);
  });

  it("previousPeriodRange is the window immediately before", () => {
    const current = periodRange({ key: "month", offset: 0 }, NOW);
    const previous = previousPeriodRange({ key: "month", offset: 0 }, NOW);
    expect(previous).toEqual(periodRange({ key: "month", offset: 1 }, NOW));
    expect(previous.to < current.from).toBe(true);
  });
});

describe("periodWindowLabel", () => {
  it("prints a concrete window for each grain", () => {
    expect(periodWindowLabel({ key: "day", offset: 0 }, NOW)).toMatch(/20 Sep/);
    expect(periodWindowLabel({ key: "week", offset: 0 }, NOW)).toMatch(/14–20 Sep/);
    expect(periodWindowLabel({ key: "month", offset: 0 }, NOW)).toMatch(/Sep.*2026/);
    expect(periodWindowLabel({ key: "year", offset: 0 }, NOW)).toBe("2026");
  });
});

describe("periodHeading", () => {
  it("uses Today / Last week / a dated window", () => {
    expect(periodHeading({ key: "day", offset: 0 }, NOW)).toBe("Today");
    expect(periodHeading({ key: "week", offset: 1 }, NOW)).toBe("Last week");
    expect(periodHeading({ key: "month", offset: 2 }, NOW)).toMatch(/Jul.*2026/);
  });
});
