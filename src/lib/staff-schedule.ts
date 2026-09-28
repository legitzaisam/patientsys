/**
 * Working patterns, time off, the month calendar, UK bank holidays and
 * practitioner invoices: pure rules shared by the profile pages, the server
 * functions (production and demo) and the unit tests. Dates are calendar
 * days as `YYYY-MM-DD` strings; nothing here reads the clock or the network.
 */

import { CLINIC_TIME_ZONE, londonMidnight } from "@/lib/metrics/period";

// ---------------------------------------------------------------- dates

/** Monday-first weekday index: 0 = Mon … 6 = Sun. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayKey = `${number}-${number}-${number}` | string;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

/** The clinic-local calendar day an instant falls on. */
export function dayKeyOf(at: string | Date, timeZone: string = CLINIC_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof at === "string" ? new Date(at) : at);
}

function utcOf(key: string): number {
  const { year, month, day } = parseDayKey(key);
  return Date.UTC(year, month - 1, day);
}

/** Monday-first weekday of a calendar day. */
export function weekdayOf(key: string): Weekday {
  const js = new Date(utcOf(key)).getUTCDay(); // 0 = Sun
  return ((js + 6) % 7) as Weekday;
}

export function addDays(key: string, days: number): string {
  const d = new Date(utcOf(key) + days * 86_400_000);
  return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `from` to `to`, inclusive of both ends. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / 86_400_000) + 1;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "Mon 28", "Wed 14 Oct", "Fri 25 Dec" — the short forms the cards use. */
export function shortDay(key: string, withMonth = false): string {
  const { day, month } = parseDayKey(key);
  const name = WEEKDAYS[weekdayOf(key)];
  return withMonth ? `${name} ${day} ${MONTHS_SHORT[month - 1]}` : `${name} ${day}`;
}

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

// ---------------------------------------------------------------- pattern

/** One weekday of a working pattern; null times mean a day off. */
export type PatternRow = {
  weekday: Weekday;
  /** "09:00" */
  start: string | null;
  /** "17:30" */
  end: string | null;
};

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** "09:00" → "9", "17:30" → "5:30", "12:00" → "12", "20:00" → "8" (12-hour, no suffix, as the mockup reads). */
export function compactTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour12 = (((h ?? 0) + 11) % 12) + 1;
  return m ? `${hour12}:${pad(m)}` : String(hour12);
}

/** A full 7-row pattern from any subset of rows; missing weekdays are off. */
export function fullPattern(rows: readonly PatternRow[]): PatternRow[] {
  return WEEKDAYS.map((_, i) => {
    const row = rows.find((r) => r.weekday === i);
    return row && row.start && row.end
      ? { weekday: i as Weekday, start: row.start, end: row.end }
      : { weekday: i as Weekday, start: null, end: null };
  });
}

export function isWorkingDay(pattern: readonly PatternRow[], key: string): boolean {
  const row = pattern.find((r) => r.weekday === weekdayOf(key));
  return Boolean(row?.start && row?.end);
}

/** Hours worked per week from the pattern (17:30 − 09:00 = 8.5). */
export function weeklyHours(pattern: readonly PatternRow[]): number {
  let minutes = 0;
  for (const row of pattern) {
    if (row.start && row.end) minutes += Math.max(0, minutesOf(row.end) - minutesOf(row.start));
  }
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * "Mon, Wed 9–5:30 · Thu 12–8 · Fri 9–3 · Sat 9–5": consecutive weekdays with
 * the same hours are grouped; days off are left out; an empty pattern reads
 * "Hours not set".
 */
export function patternSummary(pattern: readonly PatternRow[]): string {
  const groups: { days: string[]; hours: string }[] = [];
  for (const row of fullPattern(pattern)) {
    if (!row.start || !row.end) continue;
    const hours = `${compactTime(row.start)}–${compactTime(row.end)}`;
    const last = groups[groups.length - 1];
    if (last && last.hours === hours) last.days.push(WEEKDAYS[row.weekday]);
    else groups.push({ days: [WEEKDAYS[row.weekday]], hours });
  }
  if (groups.length === 0) return "Hours not set";
  return groups.map((g) => `${g.days.join(", ")} ${g.hours}`).join(" · ");
}

/** "09:00–17:30" for a working row, "Off" otherwise. */
export function rowLabel(row: PatternRow): string {
  return row.start && row.end ? `${row.start}–${row.end}` : "Off";
}

// ---------------------------------------------------------------- time off

export const TIME_OFF_TYPES = ["holiday", "training", "sickness", "other"] as const;
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const TIME_OFF_TYPE_LABEL: Record<TimeOffType, string> = {
  holiday: "Holiday",
  training: "CPD / training",
  sickness: "Sickness",
  other: "Other",
};

export const TIME_OFF_STATUSES = ["pending", "approved", "declined", "withdrawn"] as const;
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

export type HalfDay = "full" | "half";

export type TimeOffLike = {
  id: string;
  type: TimeOffType | string;
  starts_on: string;
  ends_on: string;
  start_half?: HalfDay | string | null;
  end_half?: HalfDay | string | null;
  working_days: number;
  status: TimeOffStatus | string;
  note?: string | null;
};

/**
 * Working days inside a range, skipping the pattern's days off. A half day at
 * either end takes half a day off the count (a single-day request with both
 * halves set is half a day).
 */
export function workingDaysBetween(
  from: string,
  to: string,
  pattern: readonly PatternRow[],
  startHalf: HalfDay = "full",
  endHalf: HalfDay = "full",
): number {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  let days = 0;
  for (let key = lo; key <= hi; key = addDays(key, 1)) {
    if (isWorkingDay(pattern, key)) days += 1;
  }
  if (days === 0) return 0;
  if (lo === hi) return startHalf === "half" || endHalf === "half" ? 0.5 : 1;
  if (startHalf === "half" && isWorkingDay(pattern, lo)) days -= 0.5;
  if (endHalf === "half" && isWorkingDay(pattern, hi)) days -= 0.5;
  return days;
}

export function overlapsRange(
  a: { starts_on: string; ends_on: string },
  from: string,
  to: string,
): boolean {
  return a.starts_on <= to && a.ends_on >= from;
}

/** Taken (approved, already started), booked (approved, ahead), pending — for one calendar year. */
export function timeOffTotals(
  rows: readonly TimeOffLike[],
  year: number,
  today: string,
): { taken: number; booked: number; pending: number } {
  const totals = { taken: 0, booked: 0, pending: 0 };
  for (const row of rows) {
    if (parseDayKey(row.starts_on).year !== year && parseDayKey(row.ends_on).year !== year)
      continue;
    if (row.status === "pending") totals.pending += row.working_days;
    else if (row.status === "approved") {
      if (row.starts_on <= today) totals.taken += row.working_days;
      else totals.booked += row.working_days;
    }
  }
  return totals;
}

/** "Fri 30 Oct" or "Mon 19 – Fri 23 Oct" for a request row. */
export function timeOffLabel(row: { starts_on: string; ends_on: string }): string {
  if (row.starts_on === row.ends_on) return shortDay(row.starts_on, true);
  const a = parseDayKey(row.starts_on);
  const b = parseDayKey(row.ends_on);
  if (a.month === b.month) return `${shortDay(row.starts_on)} – ${shortDay(row.ends_on, true)}`;
  return `${shortDay(row.starts_on, true)} – ${shortDay(row.ends_on, true)}`;
}

/** "Holiday · 4 working days". */
export function timeOffWhat(row: TimeOffLike): string {
  const label = TIME_OFF_TYPE_LABEL[row.type as TimeOffType] ?? row.type;
  const n = row.working_days;
  return `${label} · ${n} working day${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------- calendar

export type DayState = "work" | "off" | "holiday" | "training" | "sickness" | "other" | "pending";

export type MonthCell = {
  /** Calendar day, or null for a leading blank before the 1st. */
  key: string | null;
  day: number | null;
  weekday: Weekday;
};

/** Monday-first cells for a month: leading blanks then every day. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = dayKey(year, month, 1);
  const offset = weekdayOf(first);
  const cells: MonthCell[] = [];
  for (let i = 0; i < offset; i++) cells.push({ key: null, day: null, weekday: i as Weekday });
  const n = daysInMonth(year, month);
  for (let d = 1; d <= n; d++) {
    const key = dayKey(year, month, d);
    cells.push({ key, day: d, weekday: weekdayOf(key) });
  }
  return cells;
}

/**
 * What a calendar day is: an approved time-off type wins, then a pending
 * request, then the pattern (work / off). Withdrawn and declined rows are
 * ignored.
 */
export function dayState(
  key: string,
  pattern: readonly PatternRow[],
  timeOff: readonly TimeOffLike[],
): DayState {
  const rows = timeOff.filter((r) => r.starts_on <= key && r.ends_on >= key);
  const approved = rows.find((r) => r.status === "approved");
  if (approved) {
    const t = approved.type as DayState;
    return t === "holiday" || t === "training" || t === "sickness" ? t : "other";
  }
  if (rows.some((r) => r.status === "pending")) return "pending";
  return isWorkingDay(pattern, key) ? "work" : "off";
}

/** The next `count` days from `from` (inclusive) with their state — "Your week" reads four. */
export function nextDays(
  from: string,
  count: number,
  pattern: readonly PatternRow[],
  timeOff: readonly TimeOffLike[] = [],
): { key: string; row: PatternRow; state: DayState }[] {
  const full = fullPattern(pattern);
  const out: { key: string; row: PatternRow; state: DayState }[] = [];
  for (let i = 0; i < count; i++) {
    const key = addDays(from, i);
    out.push({ key, row: full[weekdayOf(key)]!, state: dayState(key, pattern, timeOff) });
  }
  return out;
}

// ---------------------------------------------------------------- bank holidays

export type BankHoliday = { key: string; name: string };

/** England and Wales, 2026 and 2027 (gov.uk), substitute days named as such. */
export const UK_BANK_HOLIDAYS: readonly BankHoliday[] = [
  { key: "2026-01-01", name: "New Year’s Day" },
  { key: "2026-04-03", name: "Good Friday" },
  { key: "2026-04-06", name: "Easter Monday" },
  { key: "2026-05-04", name: "Early May bank holiday" },
  { key: "2026-05-25", name: "Spring bank holiday" },
  { key: "2026-08-31", name: "Summer bank holiday" },
  { key: "2026-12-25", name: "Christmas Day" },
  { key: "2026-12-28", name: "Boxing Day (substitute)" },
  { key: "2027-01-01", name: "New Year’s Day" },
  { key: "2027-03-26", name: "Good Friday" },
  { key: "2027-03-29", name: "Easter Monday" },
  { key: "2027-05-03", name: "Early May bank holiday" },
  { key: "2027-05-31", name: "Spring bank holiday" },
  { key: "2027-08-30", name: "Summer bank holiday" },
  { key: "2027-12-27", name: "Christmas Day (substitute)" },
  { key: "2027-12-28", name: "Boxing Day (substitute)" },
];

export function upcomingBankHolidays(today: string, count = 3): BankHoliday[] {
  return UK_BANK_HOLIDAYS.filter((h) => h.key >= today).slice(0, count);
}

// ---------------------------------------------------------------- invoices

/** "NR" from "Dr Nadia Rahman": initials of the name without its title. */
export function initialsOf(fullName: string): string {
  const parts = fullName
    .replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .map((p) => p[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
}

/** "INV-NR-2026-09". */
export function invoiceNumber(initials: string, year: number, month: number): string {
  return `INV-${initials}-${year}-${pad(month)}`;
}

/**
 * The calendar month as clinic-time instants (ISO): the window getMyEarnings,
 * the invoice amount and the metrics snapshot all read.
 */
export function monthWindowIso(year: number, month: number): { from: string; to: string } {
  return {
    from: new Date(londonMidnight(year, month, 1)).toISOString(),
    to: new Date(londonMidnight(year, month + 1, 1) - 1).toISOString(),
  };
}

/** First and last calendar day of a month. */
export function invoicePeriod(year: number, month: number): { start: string; end: string } {
  return { start: dayKey(year, month, 1), end: dayKey(year, month, daysInMonth(year, month)) };
}

/** The 1st of the month after `year-month`, when a scheduled invoice goes out. */
export function nextInvoiceSendDate(year: number, month: number): string {
  return month === 12 ? dayKey(year + 1, 1, 1) : dayKey(year, month + 1, 1);
}

/** Year and month (1–12) of a calendar day. */
export function yearMonthOf(key: string): { year: number; month: number } {
  const { year, month } = parseDayKey(key);
  return { year, month };
}

/** Previous calendar month. */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// ---------------------------------------------------------------- earnings grouping

export type EarningsLineLike = {
  performedAt: string;
  name: string;
  share: number;
  payout?: "paid" | "pending" | undefined;
};

export type EarningsGroup = {
  key: string;
  label: string;
  treatments: number;
  earned: number;
  outstanding: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** One row per clinic-local day, newest first. */
export function groupLinesByDay(lines: readonly EarningsLineLike[]): EarningsGroup[] {
  const map = new Map<string, EarningsGroup>();
  for (const line of lines) {
    const key = dayKeyOf(line.performedAt);
    const g = map.get(key) ?? {
      key,
      label: shortDay(key, true),
      treatments: 0,
      earned: 0,
      outstanding: 0,
    };
    g.treatments += 1;
    g.earned = round2(g.earned + line.share);
    if (line.payout === "pending") g.outstanding = round2(g.outstanding + line.share);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** One row per month ("September 2026"), newest first. */
export function groupLinesByMonth(lines: readonly EarningsLineLike[]): EarningsGroup[] {
  const map = new Map<string, EarningsGroup>();
  for (const line of lines) {
    const { year, month } = yearMonthOf(dayKeyOf(line.performedAt));
    const key = `${year}-${pad(month)}`;
    const g = map.get(key) ?? {
      key,
      label: `${MONTHS_LONG[month - 1]} ${year}`,
      treatments: 0,
      earned: 0,
      outstanding: 0,
    };
    g.treatments += 1;
    g.earned = round2(g.earned + line.share);
    if (line.payout === "pending") g.outstanding = round2(g.outstanding + line.share);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** One row per treatment name, highest earnings first. */
export function groupLinesByTreatment(lines: readonly EarningsLineLike[]): EarningsGroup[] {
  const map = new Map<string, EarningsGroup>();
  for (const line of lines) {
    const key = line.name;
    const g = map.get(key) ?? { key, label: key, treatments: 0, earned: 0, outstanding: 0 };
    g.treatments += 1;
    g.earned = round2(g.earned + line.share);
    if (line.payout === "pending") g.outstanding = round2(g.outstanding + line.share);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.earned - a.earned || a.label.localeCompare(b.label));
}

/** Per-day totals for the bar chart: every day of the month, zero where nothing happened. */
export function dailyEarnings(
  lines: readonly EarningsLineLike[],
  year: number,
  month: number,
): { key: string; day: number; earned: number; treatments: number; outstanding: number }[] {
  const byDay = new Map(groupLinesByDay(lines).map((g) => [g.key, g]));
  const n = daysInMonth(year, month);
  const out = [];
  for (let d = 1; d <= n; d++) {
    const key = dayKey(year, month, d);
    const g = byDay.get(key);
    out.push({
      key,
      day: d,
      earned: g?.earned ?? 0,
      treatments: g?.treatments ?? 0,
      outstanding: g?.outstanding ?? 0,
    });
  }
  return out;
}
