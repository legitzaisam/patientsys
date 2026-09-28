/**
 * Reporting periods, in the clinic's time zone (Europe/London).
 *
 * Every boundary is a UK midnight worked out with Intl, so a window reads
 * the same on a server in UTC, a laptop in London and a browser anywhere,
 * and BST/GMT changes never move a visit into the wrong day or month.
 *
 * - "12 months" / "6 months": that many whole calendar months ending with
 *   the current month (1 Oct 2025 – 30 Sep 2026 on 20 Sep 2026).
 * - "1 month": the current calendar month.
 * - "7 days": the seven days ending today.
 * - A custom range runs from 00:00 on its first day to the end of its last.
 * - The previous period is the same span immediately before.
 * - Nothing after now is counted or charted: figures are read as of
 *   `asOf(window, now)` and no chart bucket starts after now.
 */

export const CLINIC_TIME_ZONE = "Europe/London";
export const DAY_MS = 86_400_000;

export type MsWindow = { fromMs: number; toMs: number };

export type PeriodKey = "day" | "week" | "month" | "year";
/** Lookback shortcuts, plus a from/to range the clinic chooses. */
export type PeriodPreset = "1w" | "1m" | "6m" | "1y" | "custom";
export type PeriodSelection = {
  key: PeriodKey;
  offset: number;
  preset?: PeriodPreset;
  /** yyyy-mm-dd inclusive. Used when `preset` is `custom`. */
  from?: string;
  to?: string;
};

export const PRESET_MONTHS: Partial<Record<PeriodPreset, number>> = { "1m": 1, "6m": 6, "1y": 12 };

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type LondonParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

/** Wall-clock parts in London. `month` is 1-based; `weekday` is 0 for Monday. */
export function londonParts(ms: number): LondonParts {
  const out: Record<string, string> = {};
  for (const p of PARTS.formatToParts(new Date(ms))) if (p.type !== "literal") out[p.type] = p.value;
  return {
    year: Number(out["year"]),
    month: Number(out["month"]),
    day: Number(out["day"]),
    hour: Number(out["hour"]),
    minute: Number(out["minute"]),
    second: Number(out["second"]),
    weekday: WEEKDAYS.indexOf(out["weekday"] ?? "Mon"),
  };
}

function offsetAt(ms: number): number {
  const p = londonParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** 00:00 in London on the given date. `month` is 1-based; out-of-range months and days roll over. */
export function londonMidnight(year: number, month: number, day: number): number {
  const wall = Date.UTC(year, month - 1, day);
  return wall - offsetAt(wall - offsetAt(wall));
}

/** London wall-clock time as an instant. */
export function londonTime(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return wall - offsetAt(wall - offsetAt(wall));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of the London day holding `ms`. */
export function londonDayKey(ms: number): string {
  const p = londonParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** YYYY-MM of the London month holding `ms`. */
export function londonMonthKey(ms: number): string {
  return londonDayKey(ms).slice(0, 7);
}

export function startOfLondonDay(ms: number): number {
  const p = londonParts(ms);
  return londonMidnight(p.year, p.month, p.day);
}

export function endOfLondonDay(ms: number): number {
  const p = londonParts(ms);
  return londonMidnight(p.year, p.month, p.day + 1) - 1;
}

/** London midnight on the same date `months` months before `ms`, the day clamped to that month's length. */
export function monthsBefore(ms: number, months: number): number {
  const p = londonParts(ms);
  const lastDay = new Date(Date.UTC(p.year, p.month - months, 0)).getUTCDate();
  return londonMidnight(p.year, p.month - months, Math.min(p.day, lastDay));
}

/** Whole London calendar months: `count` of them, ending with the month `endOffset` months before `ms`. */
export function calendarMonthsWindow(ms: number, count: number, endOffset = 0): MsWindow {
  const p = londonParts(ms);
  return {
    fromMs: londonMidnight(p.year, p.month - endOffset - (count - 1), 1),
    toMs: londonMidnight(p.year, p.month - endOffset + 1, 1) - 1,
  };
}

/** The `days` London days ending with the day holding `ms`. */
export function trailingDaysWindow(ms: number, days: number): MsWindow {
  const p = londonParts(ms);
  return {
    fromMs: londonMidnight(p.year, p.month, p.day - (days - 1)),
    toMs: londonMidnight(p.year, p.month, p.day + 1) - 1,
  };
}

function parseDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

/** From 00:00 on the first day to the end of the last day, in London. Order-insensitive. */
export function dayKeysWindow(from: string, to: string): MsWindow {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const start = parseDayKey(a);
  const end = parseDayKey(b);
  return { fromMs: londonMidnight(start.y, start.m, start.d), toMs: londonMidnight(end.y, end.m, end.d + 1) - 1 };
}

/** The window a selection names, as of `nowMs`. */
export function resolvePeriod(selection: PeriodSelection, nowMs: number): MsWindow {
  if (selection.preset === "custom" && selection.from && selection.to) return dayKeysWindow(selection.from, selection.to);
  if (selection.preset === "1w") return trailingDaysWindow(nowMs, 7);
  const months = selection.preset ? PRESET_MONTHS[selection.preset] : undefined;
  if (months) return calendarMonthsWindow(nowMs, months);
  const p = londonParts(nowMs);
  const offset = Math.max(0, Math.trunc(selection.offset) || 0);
  switch (selection.key) {
    case "day":
      return { fromMs: londonMidnight(p.year, p.month, p.day - offset), toMs: londonMidnight(p.year, p.month, p.day - offset + 1) - 1 };
    case "week": {
      const monday = p.day - p.weekday - offset * 7;
      return { fromMs: londonMidnight(p.year, p.month, monday), toMs: londonMidnight(p.year, p.month, monday + 7) - 1 };
    }
    case "year":
      return { fromMs: londonMidnight(p.year - offset, 1, 1), toMs: londonMidnight(p.year - offset + 1, 1, 1) - 1 };
    default:
      return calendarMonthsWindow(nowMs, 1, offset);
  }
}

/** The same span immediately before the selected window. */
export function previousPeriod(selection: PeriodSelection, nowMs: number): MsWindow {
  const current = resolvePeriod(selection, nowMs);
  const months = selection.preset ? PRESET_MONTHS[selection.preset] : undefined;
  if (months) return calendarMonthsWindow(nowMs, months, months);
  if (selection.preset === "1w" || selection.preset === "custom") {
    const days = Math.round((current.toMs + 1 - current.fromMs) / DAY_MS);
    const p = londonParts(current.fromMs);
    return { fromMs: londonMidnight(p.year, p.month, p.day - days), toMs: current.fromMs - 1 };
  }
  return resolvePeriod({ ...selection, offset: (selection.offset || 0) + 1 }, nowMs);
}

/** The instant a window is read at: its end, or now if the window runs past today. */
export function asOf(window: MsWindow, nowMs: number): number {
  return Math.min(window.toMs, nowMs);
}

export function inWindow(iso: string | null | undefined, window: MsWindow): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  return ms >= window.fromMs && ms <= window.toMs;
}

export type Bucket = { key: string; label: string; startMs: number; endMs: number };

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, month: "short" });
const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, weekday: "short" });
const HOUR_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", hourCycle: "h23" });

/** London calendar-month buckets from the window start to the month holding its read-at instant. */
export function monthBuckets(window: MsWindow, nowMs: number): Bucket[] {
  const end = asOf(window, nowMs);
  const out: Bucket[] = [];
  const start = londonParts(window.fromMs);
  for (let i = 0; ; i++) {
    const startMs = londonMidnight(start.year, start.month + i, 1);
    if (startMs > end) break;
    out.push({
      key: londonMonthKey(startMs),
      label: MONTH_LABEL.format(new Date(startMs)),
      startMs,
      endMs: londonMidnight(start.year, start.month + i + 1, 1),
    });
  }
  return out;
}

function dayBuckets(window: MsWindow, end: number): Bucket[] {
  const start = londonParts(window.fromMs);
  const span = Math.round((window.toMs + 1 - window.fromMs) / DAY_MS);
  const out: Bucket[] = [];
  for (let i = 0; ; i++) {
    const startMs = londonMidnight(start.year, start.month, start.day + i);
    if (startMs > end) break;
    const p = londonParts(startMs);
    out.push({
      key: londonDayKey(startMs),
      label: span <= 8 ? WEEKDAY_LABEL.format(new Date(startMs)) : String(p.day),
      startMs,
      endMs: londonMidnight(start.year, start.month, start.day + i + 1),
    });
  }
  return out;
}

function weekBuckets(window: MsWindow, end: number): Bucket[] {
  const start = londonParts(window.fromMs);
  const out: Bucket[] = [];
  for (let i = 0; ; i++) {
    const mondayMs = londonMidnight(start.year, start.month, start.day - start.weekday + i * 7);
    if (mondayMs > end) break;
    const nextMs = londonMidnight(start.year, start.month, start.day - start.weekday + (i + 1) * 7);
    const clipStart = Math.max(mondayMs, window.fromMs);
    const a = londonParts(clipStart);
    const b = londonParts(nextMs - 1);
    out.push({
      key: `${londonDayKey(mondayMs)}w`,
      label: a.month === b.month ? `${a.day}–${b.day}` : `${a.day} ${MONTH_LABEL.format(new Date(clipStart))}`,
      startMs: clipStart,
      endMs: Math.min(nextMs, window.toMs + 1),
    });
  }
  return out;
}

function hourBuckets(window: MsWindow, end: number): Bucket[] {
  const out: Bucket[] = [];
  for (let startMs = window.fromMs; startMs <= end && startMs <= window.toMs; startMs += 3_600_000) {
    out.push({
      key: `${londonDayKey(startMs)}T${pad(londonParts(startMs).hour)}`,
      label: HOUR_LABEL.format(new Date(startMs)),
      startMs,
      endMs: startMs + 3_600_000,
    });
  }
  return out;
}

/**
 * Chart buckets that suit the window's length: hours for a day, days up to
 * ten days, weeks up to 45 days, calendar months beyond. None starts after
 * now; every event in the window lands in exactly one bucket.
 */
export function chartBuckets(window: MsWindow, nowMs: number): Bucket[] {
  const end = asOf(window, nowMs);
  if (end < window.fromMs) return [];
  const days = (window.toMs + 1 - window.fromMs) / DAY_MS;
  if (days <= 1.5) return hourBuckets(window, end);
  if (days <= 10) return dayBuckets(window, end);
  if (days <= 45) return weekBuckets(window, end);
  return monthBuckets(window, nowMs);
}

/** The bucket holding `ms`, or undefined. */
export function bucketOf(buckets: readonly Bucket[], ms: number): Bucket | undefined {
  return buckets.find((b) => ms >= b.startMs && ms < b.endMs);
}
