/**
 * The patient base (Insights → Patient base). Everything is read as of the
 * window's end (or now, if the window runs past today), over patients on the
 * list (not deleted).
 *
 * - Total: records created on or before the window end. Active: of those,
 *   status active; Inactive = Total − Active (archived included).
 * - New patients: records created in the window. The chart counts the same
 *   records by month (or week, day), so its bars add up to the tile.
 * - Never treated: on the list at the window end with no visit by then.
 * - Dormant: treated before, but no visit in the 12 calendar months before
 *   the window end. It is the "12 months +" slice of the last-visit card,
 *   which splits Total by months since the last visit (under 3, 3–6, 6–12,
 *   12+, never), so the slices add up to Total.
 * - Seen: patients with a visit in the window. Once / two or more split the
 *   seen patients by visits up to the window end. New vs returning split them
 *   by whether their first-ever visit is in the window.
 * - Rebooked: of the seen patients, those with a booking (not cancelled)
 *   after their last visit in the window.
 * - Spend per patient: earned in the window ÷ seen. Visit value: earned ÷
 *   visits in the window. Both null when there is nothing to divide by.
 * - Sources: everyone in Total by the source on their record (lifetime).
 */
import { asOf, bucketOf, chartBuckets, monthsBefore, type MsWindow } from "./period";
import { INSIGHTS_SOURCES, SOURCE_LABEL, isActivePatient, isBooked, isOnList, normalizeSource, rate, type InsightsSource } from "./rules";
import { composition, firstToSecond, seenInWindow, type Visit } from "./visits";
import type { Pence } from "./money";

export type BookPatient = { id: string; status?: string | null; created_at: string; source?: string | null; deleted_at?: string | null };
export type BookAppointment = { patient_id: string; starts_at: string; status: string };

export function bookMetrics(input: {
  window: MsWindow;
  nowMs: number;
  patients: readonly BookPatient[];
  /** Every visit up to now (see visits.ts), for patients on the list. */
  visits: ReadonlyMap<string, readonly Visit[]>;
  appointments: readonly BookAppointment[];
  /** Earned in the window, in pence (money.ts), for spend and visit value. */
  earnedInWindow: Pence;
}) {
  const end = asOf(input.window, input.nowMs);
  const win: MsWindow = { fromMs: input.window.fromMs, toMs: end };
  const onList = input.patients.filter((p) => isOnList(p) && new Date(p.created_at).getTime() <= end);
  const listIds = new Set(onList.map((p) => p.id));
  const active = onList.filter(isActivePatient).length;

  const upToEnd = new Map<string, Visit[]>();
  for (const [id, list] of input.visits) {
    if (!listIds.has(id)) continue;
    const kept = list.filter((v) => new Date(v.performed_at).getTime() <= end);
    if (kept.length) upToEnd.set(id, kept);
  }

  const cut3 = monthsBefore(end, 3);
  const cut6 = monthsBefore(end, 6);
  const cut12 = monthsBefore(end, 12);
  const lastVisit = { under3: 0, from3to6: 0, from6to12: 0, over12: 0, never: 0 };
  for (const p of onList) {
    const list = upToEnd.get(p.id);
    const last = list?.[list.length - 1];
    if (!last) {
      lastVisit.never += 1;
      continue;
    }
    const ms = new Date(last.performed_at).getTime();
    if (ms >= cut3) lastVisit.under3 += 1;
    else if (ms >= cut6) lastVisit.from3to6 += 1;
    else if (ms >= cut12) lastVisit.from6to12 += 1;
    else lastVisit.over12 += 1;
  }

  const seen = seenInWindow(upToEnd, win);
  const mix = composition(seen, upToEnd, end);
  let visitsInWindow = 0;
  let firstTimers = 0;
  let rebooked = 0;
  const bookingsByPatient = new Map<string, number[]>();
  for (const a of input.appointments) {
    if (!isBooked(a) || !seen.has(a.patient_id)) continue;
    bookingsByPatient.set(a.patient_id, [...(bookingsByPatient.get(a.patient_id) ?? []), new Date(a.starts_at).getTime()]);
  }
  for (const id of seen) {
    const list = upToEnd.get(id)!;
    const inside = list.filter((v) => new Date(v.performed_at).getTime() >= win.fromMs);
    visitsInWindow += inside.length;
    if (new Date(list[0]!.performed_at).getTime() >= win.fromMs) firstTimers += 1;
    const lastInside = new Date(inside[inside.length - 1]!.performed_at).getTime();
    if ((bookingsByPatient.get(id) ?? []).some((ms) => ms > lastInside)) rebooked += 1;
  }

  const buckets = chartBuckets(input.window, input.nowMs);
  const newSeries = buckets.map((b) => ({ key: b.key, label: b.label, count: 0 }));
  let newPatients = 0;
  for (const p of onList) {
    const ms = new Date(p.created_at).getTime();
    if (ms < win.fromMs) continue;
    newPatients += 1;
    const b = bucketOf(buckets, ms);
    if (b) newSeries[buckets.indexOf(b)]!.count += 1;
  }

  const sourceCounts = new Map<InsightsSource, number>(INSIGHTS_SOURCES.map((s) => [s, 0]));
  for (const p of onList) {
    const s = normalizeSource(p.source);
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const sources = INSIGHTS_SOURCES.map((source) => ({ source, label: SOURCE_LABEL[source], count: sourceCounts.get(source) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // A second visit counts whenever it came, even after the window end.
  const listedVisits = new Map([...input.visits].filter(([id]) => listIds.has(id)));
  const secondVisit = firstToSecond(listedVisits, win, input.nowMs);
  const total = onList.length;
  return {
    window: { from: new Date(win.fromMs).toISOString(), to: new Date(end).toISOString() },
    totals: {
      total,
      active,
      inactive: total - active,
      newPatients,
      dormant: lastVisit.over12,
      dormantShare: rate(lastVisit.over12, total),
    },
    quality: {
      firstToSecond: secondVisit.rate === null ? null : secondVisit.rate / 100,
      firstToSecondCohort: secondVisit.cohort,
      rebooked: rate(rebooked, seen.size),
      rebookedCount: rebooked,
      rebookedCohort: seen.size,
      spendPerPatient: seen.size ? Math.round(input.earnedInWindow / seen.size) : null,
      visitValue: visitsInWindow ? Math.round(input.earnedInWindow / visitsInWindow) : null,
      seen: seen.size,
      visits: visitsInWindow,
      earned: input.earnedInWindow,
    },
    newSeries,
    treatedMix: { firstTimers, returning: seen.size - firstTimers },
    sources,
    composition: { neverTreated: lastVisit.never, treatedOnce: mix.once, multiTreatment: mix.twoPlus, seen: seen.size },
    lastVisit,
    secondVisit,
  };
}
