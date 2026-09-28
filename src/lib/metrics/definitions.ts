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
 * - Callers pass visits (visits.ts), so "last visit" and "days since" read
 *   appointments, not treatment rows.
 */

import { DAY_MS } from "./period";

export const DUE_SOON_DAYS = 30;
export const LAPSING_DAYS = 90;
export const LOST_DAYS = 180;

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

/** Rows grouped by patient, each list oldest first. */
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

/** Days between two ISO timestamps, floored. */
export function daysBetween(fromIso: string, toMs: number): number {
  return Math.floor((toMs - new Date(fromIso).getTime()) / DAY_MS);
}
