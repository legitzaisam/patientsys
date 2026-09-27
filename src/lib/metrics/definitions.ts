/**
 * The clinic's shared definitions. Every page that counts patients as due,
 * overdue, to chase, one-visit-only or returning imports these, so the same
 * idea is never counted two ways. Pure functions over plain rows; production
 * and demo both call them.
 *
 * Decisions (26 Sep 2026 review):
 * - Only active patients with no upcoming booking can be due, overdue or to
 *   chase. A booked patient is "booked", full stop.
 * - Due soon = next due date within DUE_SOON_DAYS. Overdue = next due date in
 *   the past, with no cut-off: an overdue patient stays overdue however long
 *   ago the date was. Lapsing / lost describe patients with no due date by
 *   days since their last visit.
 * - To chase = overdue + due soon + lapsing + lost.
 * - The next due date is the one on the patient's most recent treatment that
 *   carries one (not the earliest date on file).
 * - One visit only / treated once = exactly one treatment visit, any type.
 * - First-to-second = of patients whose first visit fell in the period and is
 *   at least SECOND_VISIT_HORIZON_DAYS old, the share with a second visit
 *   within that horizon.
 */

export const DAY_MS = 86_400_000;
export const DUE_SOON_DAYS = 30;
export const LAPSING_DAYS = 90;
export const LOST_DAYS = 180;
export const SECOND_VISIT_HORIZON_DAYS = 180;

export type TreatmentLike = {
  patient_id: string;
  performed_at: string;
  next_due_at?: string | null;
  name?: string | null;
  price?: number | null;
  practitioner_id?: string | null;
};

export type AppointmentLike = {
  patient_id: string;
  starts_at: string;
  status: string | null;
  practitioner_id?: string | null;
};

export type PatientLike = { id: string; status: string };

export type Window = { fromMs: number; toMs: number };

/** Treatments grouped by patient, each list oldest first. */
export function visitsByPatient<T extends TreatmentLike>(
  treatments: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of treatments) {
    const list = map.get(t.patient_id) ?? [];
    list.push(t);
    map.set(t.patient_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());
  }
  return map;
}

export function visitCount(visits: readonly TreatmentLike[] | undefined): number {
  return visits?.length ?? 0;
}

/** The most recent treatment that carries a due date, or null. */
export function nextDueFor<T extends TreatmentLike>(visits: readonly T[] | undefined): T | null {
  if (!visits || visits.length === 0) return null;
  let best: T | null = null;
  for (const t of visits) {
    if (!t.next_due_at) continue;
    if (!best || new Date(t.performed_at).getTime() > new Date(best.performed_at).getTime())
      best = t;
  }
  return best;
}

/** A booking counts as upcoming when it is still live and starts after `nowMs`. */
export function isUpcomingBooking(a: AppointmentLike, nowMs: number): boolean {
  if (a.status === "cancelled" || a.status === "no_show") return false;
  return new Date(a.starts_at).getTime() >= nowMs;
}

/** Patient ids with at least one upcoming booking. */
export function upcomingBookingSet(
  appointments: readonly AppointmentLike[],
  nowMs: number,
): Set<string> {
  const set = new Set<string>();
  for (const a of appointments) if (isUpcomingBooking(a, nowMs)) set.add(a.patient_id);
  return set;
}

export function hasUpcomingBooking(
  appointments: readonly AppointmentLike[],
  patientId: string,
  nowMs: number,
): boolean {
  return appointments.some((a) => a.patient_id === patientId && isUpcomingBooking(a, nowMs));
}

export type DueState =
  /** Archived or otherwise out of scope. */
  | "none"
  /** Has an upcoming booking: never due, never to chase. */
  | "booked"
  /** Never treated. */
  | "never"
  /** Next due date in the past. */
  | "overdue"
  /** Next due date within DUE_SOON_DAYS. */
  | "due_soon"
  /** No due date inside the horizon; last visit more than LOST_DAYS ago. */
  | "lost"
  /** No due date inside the horizon; last visit LAPSING_DAYS or more ago. */
  | "lapsing"
  /** Treated, nothing due, seen recently. */
  | "current";

/** Day key (YYYY-MM-DD) in the runtime's local zone; callers pass clinic-day keys where they have them. */
function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dueState(input: {
  patient: PatientLike;
  visits: readonly TreatmentLike[] | undefined;
  hasUpcoming: boolean;
  nowMs: number;
  /** Today's clinic day key (YYYY-MM-DD). Defaults to the local day of `nowMs`. */
  todayKey?: string;
}): DueState {
  if (input.patient.status === "archived") return "none";
  if (input.hasUpcoming) return "booked";
  const visits = input.visits ?? [];
  if (visits.length === 0) return "never";
  const todayKey = input.todayKey ?? dayKeyOf(input.nowMs);
  const soonKey = dayKeyOf(input.nowMs + DUE_SOON_DAYS * DAY_MS);
  const due = nextDueFor(visits);
  if (due?.next_due_at) {
    const dueKey = due.next_due_at.slice(0, 10);
    if (dueKey < todayKey) return "overdue";
    if (dueKey <= soonKey) return "due_soon";
  }
  const last = visits[visits.length - 1]!;
  const daysSince = Math.floor((input.nowMs - new Date(last.performed_at).getTime()) / DAY_MS);
  if (daysSince > LOST_DAYS) return "lost";
  if (daysSince >= LAPSING_DAYS) return "lapsing";
  return "current";
}

/** The states that belong on a chase list. */
export function isToChase(state: DueState): boolean {
  return state === "overdue" || state === "due_soon" || state === "lapsing" || state === "lost";
}

/** Due states for every patient at once, sharing the grouped visits and booking set. */
export function dueStates(input: {
  patients: readonly PatientLike[];
  treatments: readonly TreatmentLike[];
  appointments: readonly AppointmentLike[];
  nowMs: number;
  todayKey?: string;
}): Map<string, DueState> {
  const visits = visitsByPatient(input.treatments);
  const upcoming = upcomingBookingSet(input.appointments, input.nowMs);
  const out = new Map<string, DueState>();
  for (const p of input.patients) {
    out.set(
      p.id,
      dueState({
        patient: p,
        visits: visits.get(p.id),
        hasUpcoming: upcoming.has(p.id),
        nowMs: input.nowMs,
        ...(input.todayKey ? { todayKey: input.todayKey } : {}),
      }),
    );
  }
  return out;
}

export function countDueStates(states: Map<string, DueState>) {
  const counts = {
    booked: 0,
    never: 0,
    overdue: 0,
    due_soon: 0,
    lapsing: 0,
    lost: 0,
    current: 0,
    none: 0,
  };
  for (const s of states.values()) counts[s] += 1;
  return {
    ...counts,
    /** Dashboard "Treatments due": overdue + due soon. */
    treatmentsDue: counts.overdue + counts.due_soon,
    /** Dashboard "to chase" and Retention's at-risk total. */
    toChase: counts.overdue + counts.due_soon + counts.lapsing + counts.lost,
  };
}

/** Patients with at least one visit inside the window. */
export function seenInWindow(visits: Map<string, TreatmentLike[]>, window: Window): Set<string> {
  const out = new Set<string>();
  for (const [id, list] of visits) {
    if (
      list.some((t) => {
        const ms = new Date(t.performed_at).getTime();
        return ms >= window.fromMs && ms <= window.toMs;
      })
    )
      out.add(id);
  }
  return out;
}

/**
 * Visit-count composition over a population: never treated, exactly one
 * visit, two or more visits (any treatment type). The three always sum to the
 * population.
 */
export function composition(
  population: Iterable<string>,
  visits: Map<string, TreatmentLike[]>,
  upToMs = Number.POSITIVE_INFINITY,
) {
  let never = 0;
  let once = 0;
  let twoPlus = 0;
  for (const id of population) {
    const n = (visits.get(id) ?? []).filter(
      (t) => new Date(t.performed_at).getTime() <= upToMs,
    ).length;
    if (n === 0) never++;
    else if (n === 1) once++;
    else twoPlus++;
  }
  return { never, once, twoPlus, total: never + once + twoPlus };
}

/**
 * First-to-second rate. Cohort: patients whose first visit fell inside the
 * window and is at least `horizonDays` before `nowMs` (so the second visit
 * has had its chance). Returned: those with a second visit within
 * `horizonDays` of the first. `rate` is null when the cohort is empty.
 * `pending` counts first visits in the window that are still younger than the
 * horizon, for "N% so far" / "Too early" copy.
 */
export function firstToSecond(
  visits: Map<string, TreatmentLike[]>,
  window: Window,
  nowMs: number,
  horizonDays = SECOND_VISIT_HORIZON_DAYS,
) {
  const horizonMs = horizonDays * DAY_MS;
  let cohort = 0;
  let returned = 0;
  let pending = 0;
  let pendingReturned = 0;
  for (const list of visits.values()) {
    const first = list[0];
    if (!first) continue;
    const firstMs = new Date(first.performed_at).getTime();
    if (firstMs < window.fromMs || firstMs > window.toMs) continue;
    const second = list.find((t) => new Date(t.performed_at).getTime() > firstMs);
    const secondWithin = second
      ? new Date(second.performed_at).getTime() - firstMs <= horizonMs
      : false;
    if (nowMs - firstMs < horizonMs) {
      pending += 1;
      if (secondWithin) pendingReturned += 1;
      continue;
    }
    cohort += 1;
    if (secondWithin) returned += 1;
  }
  return {
    cohort,
    returned,
    rate: cohort ? Math.round((returned / cohort) * 100) : null,
    pending,
    pendingReturned,
    horizonDays,
  };
}

/** Days between two ISO timestamps, floored. */
export function daysBetween(fromIso: string, toMs: number): number {
  return Math.floor((toMs - new Date(fromIso).getTime()) / DAY_MS);
}
