/** Day boundaries in the clinic's local timezone (Europe/London), returned as ISO strings. */
export const CLINIC_TZ = "Europe/London";

function tzOffsetMs(date: Date, timeZone: string) {
  const asUTC = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const asLocal = new Date(date.toLocaleString("en-US", { timeZone }));
  return asLocal.getTime() - asUTC.getTime();
}

/** Local calendar day (yyyy-mm-dd) in the clinic timezone. */
export function clinicDayKey(now: Date = new Date(), timeZone: string = CLINIC_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole clinic-local days from `fromKey` to `toKey` (yyyy-mm-dd). */
export function clinicDayDiff(fromKey: string, toKey: string) {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2 ?? 0, (m2 ?? 1) - 1, d2 ?? 1) - Date.UTC(y1 ?? 0, (m1 ?? 1) - 1, d1 ?? 1)) /
      86400000,
  );
}

/** [start, end) of the clinic-local day containing `now`, as UTC ISO strings. */
export function clinicDayRange(now: Date = new Date(), timeZone: string = CLINIC_TZ) {
  const key = clinicDayKey(now, timeZone);
  const offset = tzOffsetMs(now, timeZone);
  const start = new Date(Date.parse(`${key}T00:00:00Z`) - offset);
  const end = new Date(start.getTime() + 86400000);
  // Re-resolve the end boundary in case of a DST shift across the day.
  const endOffset = tzOffsetMs(end, timeZone);
  const adjustedEnd = new Date(end.getTime() + (offset - endOffset));
  return { dayKey: key, startISO: start.toISOString(), endISO: adjustedEnd.toISOString() };
}

/** Monday 00:00 to next Monday 00:00 in the clinic timezone (ISO bounds). */
export function clinicWeekRange(now: Date = new Date(), timeZone: string = CLINIC_TZ) {
  const key = clinicDayKey(now, timeZone);
  const [year, month, day] = key.split("-").map(Number);
  const utcNoon = Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12);
  const mondayShift = (new Date(utcNoon).getUTCDay() + 6) % 7;
  const mondayNoon = new Date(utcNoon - mondayShift * 86400000);
  const nextMondayNoon = new Date(mondayNoon.getTime() + 7 * 86400000);
  const start = clinicDayRange(mondayNoon, timeZone);
  const end = clinicDayRange(nextMondayNoon, timeZone);
  const sundayKey = clinicDayKey(new Date(Date.parse(end.startISO) - 1), timeZone);
  return { startISO: start.startISO, endISO: end.startISO, startKey: start.dayKey, endKey: sundayKey };
}
