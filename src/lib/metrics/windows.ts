/**
 * Reporting windows. Every picker preset is a trailing window ending today
 * ("Last 12 months", never a calendar year with empty months at the end), and
 * no chart bucket ever starts after now.
 */
import { DAY_MS } from "./period";

export type MsWindow = { fromMs: number; toMs: number };

export function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function endOfDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

/** Trailing `months` calendar months, ending at the end of today. */
export function trailingMonthsWindow(nowMs: number, months: number): MsWindow {
  const start = new Date(startOfDayMs(nowMs));
  start.setMonth(start.getMonth() - months);
  return { fromMs: start.getTime(), toMs: endOfDayMs(nowMs) };
}

/** Trailing `days` days including today. */
export function trailingDaysWindow(nowMs: number, days: number): MsWindow {
  return { fromMs: startOfDayMs(nowMs) - (days - 1) * DAY_MS, toMs: endOfDayMs(nowMs) };
}

/** Clamp a window's end to now, so nothing in the future is counted or charted. */
export function clampToNow(window: MsWindow, nowMs: number): MsWindow {
  return { fromMs: Math.min(window.fromMs, nowMs), toMs: Math.min(window.toMs, nowMs) };
}

export type MonthBucket = { key: string; label: string; startMs: number; endMs: number };

/**
 * Month buckets from the window start up to (and including) the month that
 * holds `nowMs`; nothing later. The last bucket ends at now.
 */
export function monthBucketsUpToNow(window: MsWindow, nowMs: number): MonthBucket[] {
  const end = Math.min(window.toMs, nowMs);
  const cursor = new Date(
    new Date(window.fromMs).getFullYear(),
    new Date(window.fromMs).getMonth(),
    1,
  );
  const out: MonthBucket[] = [];
  while (cursor.getTime() <= end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    out.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-GB", { month: "short" }),
      startMs: cursor.getTime(),
      endMs: Math.min(next.getTime(), end),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** True when every bucket ends at or before now. */
export function noFutureBuckets(buckets: readonly { endMs: number }[], nowMs: number): boolean {
  return buckets.every((b) => b.endMs <= nowMs + 1);
}

/** Copy for the surface: what the window covers, in words. */
export function windowLabel(preset: "1w" | "1m" | "6m" | "1y"): string {
  switch (preset) {
    case "1w":
      return "Last 7 days";
    case "1m":
      return "Last month";
    case "6m":
      return "Last 6 months";
    case "1y":
      return "Last 12 months";
  }
}
