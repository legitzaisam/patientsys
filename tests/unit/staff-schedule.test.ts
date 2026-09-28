import { describe, expect, it } from "vitest";
import {
  addDays,
  dailyEarnings,
  dayState,
  daysInclusive,
  fullPattern,
  groupLinesByDay,
  groupLinesByMonth,
  groupLinesByTreatment,
  initialsOf,
  invoiceNumber,
  invoicePeriod,
  isWorkingDay,
  monthGrid,
  nextDays,
  nextInvoiceSendDate,
  patternChangeSummary,
  patternChanges,
  patternRowsFromJson,
  patternSummary,
  previousMonth,
  samePattern,
  rowLabel,
  shortDay,
  timeOffLabel,
  timeOffTotals,
  timeOffWhat,
  upcomingBankHolidays,
  weekdayOf,
  weeklyHours,
  workingDaysBetween,
  type PatternRow,
  type TimeOffLike,
} from "@/lib/staff-schedule";

/** Dr Nadia Rahman's pattern from the mockup: Tue and Sun off. */
const NADIA: PatternRow[] = [
  { weekday: 0, start: "09:00", end: "17:30" },
  { weekday: 1, start: null, end: null },
  { weekday: 2, start: "09:00", end: "17:30" },
  { weekday: 3, start: "12:00", end: "20:00" },
  { weekday: 4, start: "09:00", end: "15:00" },
  { weekday: 5, start: "09:00", end: "17:00" },
  { weekday: 6, start: null, end: null },
];

const TIME_OFF: TimeOffLike[] = [
  {
    id: "t1",
    type: "training",
    starts_on: "2026-10-14",
    ends_on: "2026-10-14",
    working_days: 1,
    status: "approved",
  },
  {
    id: "t2",
    type: "holiday",
    starts_on: "2026-10-19",
    ends_on: "2026-10-23",
    working_days: 4,
    status: "approved",
  },
  {
    id: "t3",
    type: "holiday",
    starts_on: "2026-10-30",
    ends_on: "2026-10-30",
    working_days: 1,
    status: "pending",
  },
  {
    id: "t4",
    type: "holiday",
    starts_on: "2026-02-09",
    ends_on: "2026-02-20",
    working_days: 10,
    status: "approved",
  },
  {
    id: "t5",
    type: "sickness",
    starts_on: "2026-05-05",
    ends_on: "2026-05-08",
    working_days: 4,
    status: "approved",
  },
  {
    id: "t6",
    type: "holiday",
    starts_on: "2026-11-02",
    ends_on: "2026-11-03",
    working_days: 1,
    status: "withdrawn",
  },
];

describe("dates", () => {
  it("knows weekdays Monday-first and steps days", () => {
    expect(weekdayOf("2026-09-28")).toBe(0); // Monday
    expect(weekdayOf("2026-10-04")).toBe(6); // Sunday
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysInclusive("2026-10-19", "2026-10-23")).toBe(5);
  });

  it("reads the short day forms the cards use", () => {
    expect(shortDay("2026-09-28")).toBe("Mon 28");
    expect(shortDay("2026-10-14", true)).toBe("Wed 14 Oct");
  });
});

describe("working pattern", () => {
  it("summarises consecutive days with the same hours", () => {
    expect(patternSummary(NADIA)).toBe("Mon, Wed 9–5:30 · Thu 12–8 · Fri 9–3 · Sat 9–5");
    expect(patternSummary([])).toBe("Hours not set");
    expect(
      patternSummary([
        { weekday: 0, start: "09:00", end: "17:00" },
        { weekday: 1, start: "09:00", end: "17:00" },
      ]),
    ).toBe("Mon, Tue 9–5");
  });

  it("adds the week up and labels rows", () => {
    expect(weeklyHours(NADIA)).toBe(39);
    expect(rowLabel(NADIA[0]!)).toBe("09:00–17:30");
    expect(rowLabel(NADIA[1]!)).toBe("Off");
    expect(
      fullPattern([{ weekday: 3, start: "10:00", end: "14:00" }]).filter((r) => r.start),
    ).toHaveLength(1);
  });

  it("knows which calendar days are worked", () => {
    expect(isWorkingDay(NADIA, "2026-10-13")).toBe(false); // Tuesday
    expect(isWorkingDay(NADIA, "2026-10-14")).toBe(true); // Wednesday
  });
});

describe("time off", () => {
  it("counts working days across a range, skipping days off", () => {
    // 9–13 Nov 2026 is Mon–Fri; Tuesday is off, so four working days.
    expect(workingDaysBetween("2026-11-09", "2026-11-13", NADIA)).toBe(4);
    // Reversed range is the same range.
    expect(workingDaysBetween("2026-11-13", "2026-11-09", NADIA)).toBe(4);
    // A week including the weekend: Sat works, Sun does not.
    expect(workingDaysBetween("2026-11-09", "2026-11-15", NADIA)).toBe(5);
    // Only days off → 0.
    expect(workingDaysBetween("2026-11-10", "2026-11-10", NADIA)).toBe(0);
  });

  it("takes half days off the ends", () => {
    expect(workingDaysBetween("2026-11-09", "2026-11-13", NADIA, "half", "full")).toBe(3.5);
    expect(workingDaysBetween("2026-11-09", "2026-11-13", NADIA, "half", "half")).toBe(3);
    expect(workingDaysBetween("2026-11-09", "2026-11-09", NADIA, "half", "full")).toBe(0.5);
  });

  it("totals taken, booked and pending for the year", () => {
    expect(timeOffTotals(TIME_OFF, 2026, "2026-09-28")).toEqual({
      taken: 14,
      booked: 5,
      pending: 1,
    });
    // Once October has passed, the booked days are taken.
    expect(timeOffTotals(TIME_OFF, 2026, "2026-11-01")).toEqual({
      taken: 19,
      booked: 0,
      pending: 1,
    });
    expect(timeOffTotals(TIME_OFF, 2025, "2026-09-28")).toEqual({
      taken: 0,
      booked: 0,
      pending: 0,
    });
  });

  it("labels a request", () => {
    expect(timeOffLabel(TIME_OFF[2]!)).toBe("Fri 30 Oct");
    expect(timeOffLabel(TIME_OFF[1]!)).toBe("Mon 19 – Fri 23 Oct");
    expect(timeOffLabel({ starts_on: "2026-09-28", ends_on: "2026-10-02" })).toBe(
      "Mon 28 Sep – Fri 2 Oct",
    );
    expect(timeOffWhat(TIME_OFF[1]!)).toBe("Holiday · 4 working days");
    expect(timeOffWhat(TIME_OFF[0]!)).toBe("CPD / training · 1 working day");
  });
});

describe("calendar", () => {
  it("lays October 2026 out Monday-first with three leading blanks", () => {
    const cells = monthGrid(2026, 10);
    expect(cells.slice(0, 3).every((c) => c.key === null)).toBe(true);
    expect(cells[3]).toMatchObject({ key: "2026-10-01", day: 1, weekday: 3 });
    expect(cells).toHaveLength(3 + 31);
    expect(cells[cells.length - 1]).toMatchObject({ day: 31, weekday: 5 });
  });

  it("reads a day's state from time off first, then the pattern", () => {
    expect(dayState("2026-10-14", NADIA, TIME_OFF)).toBe("training");
    expect(dayState("2026-10-21", NADIA, TIME_OFF)).toBe("holiday");
    expect(dayState("2026-10-30", NADIA, TIME_OFF)).toBe("pending");
    expect(dayState("2026-10-13", NADIA, TIME_OFF)).toBe("off");
    expect(dayState("2026-10-15", NADIA, TIME_OFF)).toBe("work");
    // Withdrawn requests do not colour the calendar.
    expect(dayState("2026-11-02", NADIA, TIME_OFF)).toBe("work");
  });

  it("gives 'Your week' the next days with their hours", () => {
    const days = nextDays("2026-09-28", 4, NADIA, TIME_OFF);
    expect(days.map((d) => [d.key, d.state, rowLabel(d.row)])).toEqual([
      ["2026-09-28", "work", "09:00–17:30"],
      ["2026-09-29", "off", "Off"],
      ["2026-09-30", "work", "09:00–17:30"],
      ["2026-10-01", "work", "12:00–20:00"],
    ]);
  });
});

describe("bank holidays", () => {
  it("lists the next three from today", () => {
    expect(upcomingBankHolidays("2026-09-28")).toEqual([
      { key: "2026-12-25", name: "Christmas Day" },
      { key: "2026-12-28", name: "Boxing Day (substitute)" },
      { key: "2027-01-01", name: "New Year’s Day" },
    ]);
    expect(upcomingBankHolidays("2026-12-26", 1)).toEqual([
      { key: "2026-12-28", name: "Boxing Day (substitute)" },
    ]);
  });
});

describe("invoices", () => {
  it("numbers and dates an invoice", () => {
    expect(initialsOf("Dr Nadia Rahman")).toBe("NR");
    expect(initialsOf("Sofia Marchetti")).toBe("SM");
    expect(invoiceNumber("NR", 2026, 9)).toBe("INV-NR-2026-09");
    expect(invoicePeriod(2026, 9)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(invoicePeriod(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(nextInvoiceSendDate(2026, 9)).toBe("2026-10-01");
    expect(nextInvoiceSendDate(2026, 12)).toBe("2027-01-01");
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("earnings grouping", () => {
  const lines = [
    {
      performedAt: "2026-09-26T10:00:00Z",
      name: "Dermal fillers",
      share: 300,
      payout: "pending" as const,
    },
    {
      performedAt: "2026-09-26T14:00:00Z",
      name: "Anti-wrinkle injections",
      share: 110,
      payout: "paid" as const,
    },
    {
      performedAt: "2026-09-25T09:30:00Z",
      name: "Anti-wrinkle injections",
      share: 110,
      payout: "paid" as const,
    },
    {
      performedAt: "2026-08-12T09:30:00Z",
      name: "Chemical peel",
      share: 60.25,
      payout: "paid" as const,
    },
  ];

  it("groups by day, newest first, with outstanding from pending lines", () => {
    expect(groupLinesByDay(lines)).toEqual([
      { key: "2026-09-26", label: "Sat 26 Sep", treatments: 2, earned: 410, outstanding: 300 },
      { key: "2026-09-25", label: "Fri 25 Sep", treatments: 1, earned: 110, outstanding: 0 },
      { key: "2026-08-12", label: "Wed 12 Aug", treatments: 1, earned: 60.25, outstanding: 0 },
    ]);
  });

  it("groups by month and by treatment", () => {
    expect(groupLinesByMonth(lines).map((g) => [g.label, g.treatments, g.earned])).toEqual([
      ["September 2026", 3, 520],
      ["August 2026", 1, 60.25],
    ]);
    expect(groupLinesByTreatment(lines).map((g) => [g.label, g.treatments, g.earned])).toEqual([
      ["Dermal fillers", 1, 300],
      ["Anti-wrinkle injections", 2, 220],
      ["Chemical peel", 1, 60.25],
    ]);
  });

  it("fills every day of the month for the bars", () => {
    const days = dailyEarnings(lines, 2026, 9);
    expect(days).toHaveLength(30);
    expect(days[25]).toMatchObject({ day: 26, earned: 410, treatments: 2, outstanding: 300 });
    expect(days[0]).toMatchObject({ day: 1, earned: 0, treatments: 0 });
  });
});

describe("pattern change summary", () => {
  const current: PatternRow[] = [
    { weekday: 0, start: "10:00", end: "19:00" },
    { weekday: 2, start: null, end: null },
    { weekday: 5, start: "09:00", end: "14:00" },
  ];
  const proposed: PatternRow[] = [
    { weekday: 0, start: "10:00", end: "19:00" },
    { weekday: 2, start: "10:00", end: "18:00" },
    { weekday: 5, start: null, end: null },
  ];
  it("lists only the days that differ, Monday-first", () => {
    expect(patternChanges(current, proposed)).toEqual([
      { weekday: 2, from: "Off", to: "10:00–18:00" },
      { weekday: 5, from: "09:00–14:00", to: "Off" },
    ]);
    expect(patternChangeSummary(current, proposed)).toBe(
      "Wed 10:00–18:00 (was Off) · Sat Off (was 09:00–14:00)",
    );
    expect(patternChangeSummary(current, current)).toBe("No change");
    expect(samePattern(current, fullPattern(current))).toBe(true);
    expect(samePattern(current, proposed)).toBe(false);
  });
  it("reads stored jsonb rows and treats malformed entries as days off", () => {
    const rows = patternRowsFromJson([
      { weekday: 0, start: "09:00", end: "17:00" },
      { weekday: 1, start: 9, end: null },
      "junk",
    ]);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ weekday: 0, start: "09:00", end: "17:00" });
    expect(rows[1]).toEqual({ weekday: 1, start: null, end: null });
    expect(patternRowsFromJson(null)).toHaveLength(7);
  });
});
